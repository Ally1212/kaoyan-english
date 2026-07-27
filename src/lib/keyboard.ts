export const keyBindings = ['W', 'A', 'S', 'D'] as const

export function getOptionIndexForKey(key: string): number {
  return keyBindings.indexOf(key.toUpperCase() as typeof keyBindings[number])
}
