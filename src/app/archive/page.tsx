import { redirect } from 'next/navigation'

// Saved board reports are admin-only (they may contain material nonpublic
// information). Old links to the public archive go to the login-gated one.
export default function ArchivePage() {
  redirect('/admin/archive')
}
