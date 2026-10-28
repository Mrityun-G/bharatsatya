export interface SignupFields {
  name: string;
  email: string;
  institutionName: string;
  designation: string;
  password: string;
  confirmPassword: string;
}

export type SignupFieldErrors = Partial<Record<keyof SignupFields, string>>;

export function validateSignup(fields: SignupFields): SignupFieldErrors {
  const errors: SignupFieldErrors = {};
  if (!fields.name.trim()) errors.name = 'Enter your full name.';
  if (!fields.email.trim()) errors.email = 'Enter your institutional email.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) errors.email = 'Enter a valid email address.';
  if (!fields.institutionName.trim()) errors.institutionName = 'Enter your institution name.';
  if (!fields.designation.trim()) errors.designation = 'Enter your designation.';
  if (fields.password.length < 8) errors.password = 'Use at least 8 characters.';
  if (fields.password !== fields.confirmPassword) errors.confirmPassword = 'The passwords do not match.';
  return errors;
}
