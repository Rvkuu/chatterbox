// Length is counted in Unicode characters (code points), not UTF-16 units, so an emoji counts as
// one character. The database counts the same way for varchar(280) (DB4 in docs/database.md).
export function countCharacters(value: string): number {
  return [...value].length;
}
