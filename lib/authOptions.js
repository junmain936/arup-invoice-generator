import GoogleProvider from 'next-auth/providers/google'
import { getDb } from './firebase'

// Google Login + Drive access (drive.file scope = sirf app dwara banayi files)
export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/drive.file',
          access_type: 'offline', // refresh_token paane ke liye
          prompt: 'consent', // har baar refresh_token mile
        },
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        // Refresh token Firestore me save karo (server se Drive upload ke liye)
        if (account.refresh_token && token.email) {
          try {
            await getDb()
              .collection('drive_tokens')
              .doc(token.email)
              .set(
                {
                  refresh_token: account.refresh_token,
                  updated_at: new Date().toISOString(),
                },
                { merge: true }
              )
          } catch (e) {
            console.error('drive token save fail:', e.message)
          }
        }
      }
      return token
    },
  },
}
