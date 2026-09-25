/* Display helper: render film counts as honest ranges ("50–100 films") instead of
   exact numbers. Every bucket contains the true count — ranges read livelier
   than single integers without misrepresenting sample size. */

export function countRange(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n) || n < 0) return 'limited data'
  if (n < 5) return 'under 5 films'
  if (n < 10) return '5–10 films'
  if (n < 25) return '10–25 films'
  if (n < 50) return '25–50 films'
  if (n < 100) return '50–100 films'
  if (n < 250) return '100–250 films'
  if (n < 500) return '250–500 films'
  return '500+ films'
}
