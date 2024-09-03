export async function batch<T, R>(
  items: Array<T>,
  transform: (item: T, index: number) => Promise<R>,
  size: number = 5
) {
  let results: Array<R> = [];
  for (let start = 0; start < items.length; start += size) {
    const end = start + size > items.length ? items.length : start + size;

    const slicedResults = await Promise.all(
      items.slice(start, end).map((item, i) => transform(item, start + i))
    );

    results = [...results, ...slicedResults];
  }
  return results;
}
