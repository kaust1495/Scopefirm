export const editorCookie = (id: string) => `scopefirm_editor_${id}`;

export const editorCookieOptions = (id: string) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: `/quotes/${id}`,
  maxAge: 60 * 60 * 24 * 30,
});
