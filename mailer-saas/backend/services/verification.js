import dns from 'dns/promises';
import * as yup from 'yup';

// 1. Yup Schema for Contact Payload Validation
export const contactValidationSchema = yup.object({
  name: yup.string().trim().required('Name is required'),
  email: yup.string().email('Invalid email format').required('Email is required'),
  company: yup.string().optional(),
  mobile: yup.string().optional(),
  industry: yup.string().optional(),
  group: yup.string().optional()
});

// 2. Deep DNS MX Record Lookup Helper
export async function verifyEmailMX(email) {
  try {
    if (!email || !email.includes('@')) return false;
    const domain = email.split('@')[1].trim();
    
    // Query DNS Mail Exchange (MX) records for the domain
    const addresses = await dns.resolveMx(domain);
    
    // If the domain has valid mail servers configured, it can receive emails
    return addresses && addresses.length > 0;
  } catch (err) {
    // If domain lookup fails or has no MX records, it's a dead/fake domain
    return false;
  }
}