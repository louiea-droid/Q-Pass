import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { findStaff } from '@/lib/staff'
import { getStaffList } from '@/lib/store'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  pages: { signIn: '/signin', error: '/denied' },
  callbacks: {
    // Only people listed (and active) in the Staff tab may sign in.
    async signIn({ user }) {
      return user.email && findStaff(await getStaffList(), user.email) ? true : '/denied'
    },
  },
})
