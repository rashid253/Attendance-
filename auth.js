// Principal signup
await requestSignup(cred.user.uid, 'principal', { email });

// Teacher signup
await requestSignup(cred.user.uid, 'teacher', {
  email,
  school,
  clazz,
  section
});
