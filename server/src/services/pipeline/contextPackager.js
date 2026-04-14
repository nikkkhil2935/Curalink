// Placeholder context packager for RAG. Final prompt packaging will be added later.
export function packageContext({ publications = [], trials = [] }) {
  const all = [...publications, ...trials].slice(0, 13);

  return {
    items: all,
    snippets: all.map((item, index) => `S${index + 1}: ${item.title || 'Untitled source'}`)
  };
}
