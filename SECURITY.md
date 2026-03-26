# Security Policy

## Reporting a Vulnerability

Please do NOT create a public issue for security vulnerabilities. Instead:

1. Email security@example.com with details of the vulnerability
2. Include proof of concept if possible
3. Allow 90 days for response before public disclosure

We take security seriously and will investigate all reports promptly.

## Security Best Practices

When deploying ProExam in production:

1. **Change Default Secrets**
   - Update JWT_SECRET in .env
   - Use strong, random values

2. **Enable HTTPS**
   - Always use HTTPS in production
   - Update CORS_ORIGIN to specific domains

3. **Database Security**
   - Use isolated database instance
   - Enable database backups
   - Restrict database access

4. **Environment Variables**
   - Never commit .env files
   - Use secure secrets management
   - Rotate secrets regularly

5. **Keep Dependencies Updated**
   - Run `npm audit` regularly
   - Update packages promptly
   - Monitor security advisories

6. **Access Control**
   - Implement proper authentication
   - Restrict admin panel access
   - Use role-based access control

7. **Monitoring & Logging**
   - Enable comprehensive logging
   - Monitor for suspicious activity
   - Review logs regularly

## Known Vulnerabilities

None currently known. Please report any discovered vulnerabilities responsibly.
