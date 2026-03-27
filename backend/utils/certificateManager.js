// Certificate generation and management
class CertificateManager {
  constructor() {
    this.certificates = new Map(); // certificateId -> certificate data
    this.templates = new Map(); // templateId -> template data
    this.defaultTemplate = {
      id: 'default',
      name: 'Standard Certificate',
      backgroundColor: '#f8f9fa',
      textColor: '#333',
      fontFamily: 'Arial, sans-serif',
      logoUrl: null,
      signatureLine: true,
      includeScore: true,
      includeDate: true,
      customText: 'This certifies that {studentName} has successfully completed the examination for {examTitle} with a score of {score}%.'
    };

    this.templates.set('default', this.defaultTemplate);
  }

  // Generate certificate for exam completion
  generateCertificate(sessionId, resultData) {
    const {
      studentId,
      studentName,
      examId,
      examTitle,
      score,
      percentage,
      passed,
      completedAt,
      organizerName = 'Exam Organizer'
    } = resultData;

    const certificateId = `cert_${sessionId}_${Date.now()}`;
    const certificate = {
      id: certificateId,
      sessionId,
      studentId,
      studentName,
      examId,
      examTitle,
      score,
      percentage,
      passed,
      completedAt: new Date(completedAt),
      issuedAt: new Date(),
      organizerName,
      templateId: 'default',
      verificationCode: this.generateVerificationCode(),
      status: 'active'
    };

    this.certificates.set(certificateId, certificate);
    return certificate;
  }

  // Generate verification code
  generateVerificationCode() {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
  }

  // Get certificate by ID
  getCertificate(certificateId) {
    return this.certificates.get(certificateId);
  }

  // Verify certificate
  verifyCertificate(certificateId, verificationCode) {
    const certificate = this.certificates.get(certificateId);
    if (!certificate) {
      return { valid: false, reason: 'Certificate not found' };
    }

    if (certificate.verificationCode !== verificationCode) {
      return { valid: false, reason: 'Invalid verification code' };
    }

    if (certificate.status !== 'active') {
      return { valid: false, reason: 'Certificate is not active' };
    }

    return {
      valid: true,
      certificate: {
        id: certificate.id,
        studentName: certificate.studentName,
        examTitle: certificate.examTitle,
        score: certificate.percentage,
        passed: certificate.passed,
        completedAt: certificate.completedAt,
        issuedAt: certificate.issuedAt,
        organizerName: certificate.organizerName
      }
    };
  }

  // Get certificates for a student
  getStudentCertificates(studentId) {
    return Array.from(this.certificates.values())
      .filter(cert => cert.studentId === studentId && cert.status === 'active')
      .sort((a, b) => b.issuedAt - a.issuedAt);
  }

  // Revoke certificate
  revokeCertificate(certificateId, reason = 'Administrative action') {
    const certificate = this.certificates.get(certificateId);
    if (certificate) {
      certificate.status = 'revoked';
      certificate.revokedAt = new Date();
      certificate.revokeReason = reason;
      return true;
    }
    return false;
  }

  // Create custom certificate template
  createTemplate(templateData) {
    const {
      id,
      name,
      backgroundColor = '#f8f9fa',
      textColor = '#333',
      fontFamily = 'Arial, sans-serif',
      logoUrl = null,
      signatureLine = true,
      includeScore = true,
      includeDate = true,
      customText = ''
    } = templateData;

    const template = {
      id,
      name,
      backgroundColor,
      textColor,
      fontFamily,
      logoUrl,
      signatureLine,
      includeScore,
      includeDate,
      customText,
      createdAt: new Date()
    };

    this.templates.set(id, template);
    return template;
  }

  // Get certificate template
  getTemplate(templateId) {
    return this.templates.get(templateId) || this.defaultTemplate;
  }

  // Generate HTML certificate
  generateHTMLCertificate(certificate) {
    const template = this.getTemplate(certificate.templateId);

    const customText = template.customText
      .replace('{studentName}', certificate.studentName)
      .replace('{examTitle}', certificate.examTitle)
      .replace('{score}', certificate.percentage);

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Certificate - ${certificate.examTitle}</title>
        <style>
          body {
            font-family: ${template.fontFamily};
            background-color: ${template.backgroundColor};
            color: ${template.textColor};
            margin: 0;
            padding: 40px;
            text-align: center;
          }
          .certificate {
            max-width: 800px;
            margin: 0 auto;
            padding: 60px;
            border: 5px solid #333;
            background: white;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
          }
          .header {
            margin-bottom: 40px;
          }
          .title {
            font-size: 36px;
            font-weight: bold;
            margin-bottom: 20px;
            color: #2563eb;
          }
          .content {
            font-size: 18px;
            line-height: 1.6;
            margin-bottom: 40px;
          }
          .details {
            display: flex;
            justify-content: space-between;
            margin-bottom: 40px;
            font-size: 16px;
          }
          .signature {
            margin-top: 60px;
            border-top: 2px solid #333;
            width: 200px;
            margin-left: auto;
            margin-right: auto;
            padding-top: 10px;
          }
          .verification {
            margin-top: 40px;
            font-size: 12px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="certificate">
          <div class="header">
            <h1 class="title">Certificate of Completion</h1>
          </div>

          <div class="content">
            <p>${customText}</p>
          </div>

          <div class="details">
            <div>
              <strong>Student:</strong> ${certificate.studentName}<br>
              <strong>Exam:</strong> ${certificate.examTitle}<br>
              ${template.includeDate ? `<strong>Date:</strong> ${certificate.completedAt.toLocaleDateString()}` : ''}
            </div>
            <div>
              ${template.includeScore ? `<strong>Score:</strong> ${certificate.percentage}%<br>` : ''}
              <strong>Status:</strong> ${certificate.passed ? 'Passed' : 'Completed'}<br>
              <strong>Issued:</strong> ${certificate.issuedAt.toLocaleDateString()}
            </div>
          </div>

          ${template.signatureLine ? `
            <div class="signature">
              ${certificate.organizerName}
            </div>
          ` : ''}

          <div class="verification">
            Verification Code: ${certificate.verificationCode}<br>
            Certificate ID: ${certificate.id}
          </div>
        </div>
      </body>
      </html>
    `;

    return html;
  }

  // Generate PDF certificate (placeholder - would use puppeteer or similar)
  async generatePDFCertificate(certificate) {
    const html = this.generateHTMLCertificate(certificate);

    // In a real implementation, this would use puppeteer to convert HTML to PDF
    // For now, return the HTML as a placeholder
    return {
      html,
      pdfUrl: `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
    };
  }

  // Bulk certificate generation
  generateBulkCertificates(results) {
    const certificates = results.map(result => this.generateCertificate(result.sessionId, result));
    return certificates;
  }

  // Get certificate statistics
  getCertificateStats() {
    const stats = {
      totalCertificates: this.certificates.size,
      activeCertificates: 0,
      revokedCertificates: 0,
      certificatesByExam: new Map(),
      recentCertificates: []
    };

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    for (const certificate of this.certificates.values()) {
      if (certificate.status === 'active') stats.activeCertificates++;
      if (certificate.status === 'revoked') stats.revokedCertificates++;

      // Count by exam
      const examCount = stats.certificatesByExam.get(certificate.examId) || 0;
      stats.certificatesByExam.set(certificate.examId, examCount + 1);

      // Recent certificates
      if (certificate.issuedAt > thirtyDaysAgo) {
        stats.recentCertificates.push({
          id: certificate.id,
          studentName: certificate.studentName,
          examTitle: certificate.examTitle,
          issuedAt: certificate.issuedAt
        });
      }
    }

    stats.certificatesByExam = Object.fromEntries(stats.certificatesByExam);
    stats.recentCertificates.sort((a, b) => b.issuedAt - a.issuedAt);

    return stats;
  }
}

module.exports = CertificateManager;