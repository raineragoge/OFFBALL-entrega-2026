export const cx = (...c: (string | false | null | undefined | 0)[]) => c.filter(Boolean).join(' ')
