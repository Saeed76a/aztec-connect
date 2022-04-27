import { toBufferBE } from '@aztec/barretenberg/bigint_buffer';
import { NotePicker } from './';
import { Note } from '../note';

const computeNullifier = (value: bigint) => toBufferBE(value, 32);

const computeNullifiers = (values: bigint[]) => values.map(computeNullifier);

const randomNote = (value: bigint, allowChain = false, pending = false) =>
  ({
    value,
    nullifier: computeNullifier(value),
    allowChain,
    pending,
  } as Note);

const randomNotes = (values: bigint[]) => values.map(value => randomNote(value));

const expectNoteValues = (notes: Note[], values: bigint[] = []) => {
  expect(notes).toEqual(values.map(value => expect.objectContaining({ value })));
};

describe('NotePicker', () => {
  const notes = randomNotes([10n, 1n, 0n, 7n, 3n, 2n]);

  it('pick no more than 2 notes whose sum is equal to or larger than the required sum', () => {
    const notePicker = new NotePicker(notes);
    expectNoteValues(notePicker.pick(20n), []);
    expectNoteValues(notePicker.pick(15n), [7n, 10n]);
    expectNoteValues(notePicker.pick(10n), [3n, 7n]);
    expectNoteValues(notePicker.pick(7n), [0n, 7n]);
    expectNoteValues(notePicker.pick(0n), [0n]);
  });

  it('pick 1 note whose value is equal to or larger than the required sum', () => {
    const notePicker = new NotePicker(notes);
    expect(notePicker.pickOne(15n)?.value).toBe(undefined);
    expect(notePicker.pickOne(10n)?.value).toBe(10n);
    expect(notePicker.pickOne(5n)?.value).toBe(7n);
    expect(notePicker.pickOne(2n)?.value).toBe(2n);
    expect(notePicker.pickOne(0n)?.value).toBe(0n);
  });

  it('pick a pair of notes that contains at most one note with allowChain set to true', () => {
    const chainableNotes = [randomNote(5n, true, true), randomNote(4n, true, true), randomNote(6n, true, true)];
    const notePicker = new NotePicker([...notes, ...chainableNotes]);
    expectNoteValues(notePicker.pick(11n), [4n, 7n]);
  });

  it('will not pick a pending note with allowChain set to false', () => {
    const pendingNotes = [randomNote(5n, false, true), randomNote(4n, false, true), randomNote(6n, false, true)];
    const notePicker = new NotePicker([...notes, ...pendingNotes]);
    expectNoteValues(notePicker.pick(11n), [1n, 10n]);
  });

  it('will not pick excluded notes', () => {
    const notePicker = new NotePicker(notes);
    expectNoteValues(notePicker.pick(10n), [3n, 7n]);
    {
      const excludeNullifiers = computeNullifiers([7n]);
      expectNoteValues(notePicker.pick(10n, excludeNullifiers), [0n, 10n]);
    }
    {
      const excludeNullifiers = computeNullifiers([0n]);
      expectNoteValues(notePicker.pick(10n, excludeNullifiers), [3n, 7n]);
      expectNoteValues(notePicker.pick(7n, excludeNullifiers), [7n]);
    }
    {
      const excludeNullifiers = computeNullifiers([7n, 10n]);
      expectNoteValues(notePicker.pick(10n, excludeNullifiers), []);
    }
  });

  it('calculate the sum of settled notes', () => {
    {
      const notePicker = new NotePicker(notes);
      expect(notePicker.getSum()).toBe(23n);
    }
    {
      const notePicker = new NotePicker([...notes, randomNote(5n, false, true), randomNote(4n, true, true)]);
      expect(notePicker.getSum()).toBe(23n);
    }
  });

  it('calculate the sum of spendable notes', () => {
    const notePicker = new NotePicker([
      ...notes,
      randomNote(5n, false, true),
      randomNote(4n, true, true),
      randomNote(6n, false, true),
    ]);
    expect(notePicker.getSpendableSum()).toBe(27n);
    {
      const excludeNullifiers = computeNullifiers([10n, 7n]);
      expect(notePicker.getSpendableSum(excludeNullifiers)).toBe(10n);
    }
    {
      const excludeNullifiers = computeNullifiers([2n, 4n]);
      expect(notePicker.getSpendableSum(excludeNullifiers)).toBe(21n);
    }
    {
      const excludeNullifiers = computeNullifiers([2n, 4n, 5n]);
      expect(notePicker.getSpendableSum(excludeNullifiers)).toBe(21n);
    }
  });

  it('calculate the sum of 2 largest spendable notes', () => {
    const notePicker = new NotePicker([
      ...notes,
      randomNote(5n, false, true),
      randomNote(4n, true, true),
      randomNote(6n, false, true),
    ]);
    expect(notePicker.getMaxSpendableValue()).toBe(10n + 7n);
    {
      const excludeNullifiers = computeNullifiers([10n, 3n]);
      expect(notePicker.getMaxSpendableValue(excludeNullifiers)).toBe(7n + 4n);
    }
    {
      // exclude all but 3n
      const excludeNullifiers = computeNullifiers([0n, 1n, 2n, 4n, 7n, 10n]);
      expect(notePicker.getMaxSpendableValue(excludeNullifiers)).toBe(3n);
    }
  });

  it('find the value of the largest spendable note', () => {
    const numNotes = 1;
    const notePicker = new NotePicker([
      ...notes,
      randomNote(5n, false, true),
      randomNote(4n, true, true),
      randomNote(6n, false, true),
    ]);
    expect(notePicker.getMaxSpendableValue([], numNotes)).toBe(10n);
    {
      const excludeNullifiers = computeNullifiers([10n, 3n]);
      expect(notePicker.getMaxSpendableValue(excludeNullifiers, numNotes)).toBe(7n);
    }
    {
      // exclude all but 3n
      const excludeNullifiers = computeNullifiers([0n, 1n, 2n, 4n, 7n, 10n]);
      expect(notePicker.getMaxSpendableValue(excludeNullifiers, numNotes)).toBe(3n);
    }
  });
});
