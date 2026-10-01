export function homeFor(role) {
  if (role === 'hospital') return '/hospital'
  if (role === 'doctor') return '/doctor'
  if (role === 'admin') return '/admin'
  return '/dashboard'
}
