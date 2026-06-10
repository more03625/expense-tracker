export function fmt(n: number | undefined | null): string {
  return '₹' + Number(n || 0).toLocaleString('en-IN')
}

export function fmtPercent(n: number): string {
  return `${n.toFixed(1)}%`
}

export function getCatColor(categories: { id: string; name: string; color: string }[], nameOrId: string): string {
  if (!nameOrId) return '#6b7280'
  const lower = nameOrId.toLowerCase()
  const cat = categories.find(c => c.id === lower || c.name.toLowerCase() === lower)
  return cat?.color || '#6b7280'
}
