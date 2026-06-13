package com.pesito.auth.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class EmailVerificationService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.from:noreply@pesito.app}")
    private String fromAddress;

    public void sendVerificationEmail(String toEmail, String code) {
        mailSender.send(mime -> {
            // multipart=true: obligatorio para setText(plain, html) — sin esto tira IllegalStateException
            MimeMessageHelper helper = new MimeMessageHelper(mime, true, "UTF-8");
            helper.setFrom(fromAddress);
            helper.setTo(toEmail);
            helper.setSubject("Tu código de verificación — Pesito");
            // Texto plano como fallback para clientes sin HTML
            helper.setText(
                "Tu código de verificación de Pesito es: " + code + "\n" +
                "El código expira en 24 horas.\n\n" +
                "Si no creaste esta cuenta, ignorá este email.",
                buildHtml(code)
            );
        });
    }

    public void sendPasswordResetEmail(String toEmail, String code) {
        mailSender.send(mime -> {
            // multipart=true: obligatorio para setText(plain, html) — sin esto tira IllegalStateException
            MimeMessageHelper helper = new MimeMessageHelper(mime, true, "UTF-8");
            helper.setFrom(fromAddress);
            helper.setTo(toEmail);
            helper.setSubject("Restablecé tu contraseña — Pesito");
            // Texto plano como fallback para clientes sin HTML
            helper.setText(
                "Tu código para restablecer tu contraseña de Pesito es: " + code + "\n" +
                "El código expira en 1 hora.\n\n" +
                "Si no pediste este cambio, ignorá este email.",
                buildPasswordResetHtml(code)
            );
        });
    }

    // Estilos inline y layout con tablas: es lo único que renderiza
    // consistente en Gmail/Outlook (no soportan <style> ni flexbox)
    private String buildHtml(String code) {
        return """
            <!DOCTYPE html>
            <html lang="es">
            <body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;">
                <tr>
                  <td align="center" style="padding:40px 16px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:440px;background-color:#ffffff;border-radius:16px;border:1px solid #e5e7eb;">
                      <tr>
                        <td align="center" style="padding:40px 32px;">
                          <p style="margin:0 0 24px;font-size:24px;font-weight:700;color:#111827;">&#128184; Pesito</p>
                          <p style="margin:0 0 8px;font-size:20px;font-weight:600;color:#111827;">Verific&aacute; tu email</p>
                          <p style="margin:0 0 28px;font-size:14px;color:#6b7280;line-height:1.6;">Ingres&aacute; este c&oacute;digo en la app para activar tu cuenta:</p>
                          <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 28px;">
                            <tr>
                              <td style="background-color:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:16px 32px;">
                                <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#059669;font-family:'Courier New',Courier,monospace;">{code}</span>
                              </td>
                            </tr>
                          </table>
                          <p style="margin:0 0 28px;font-size:13px;color:#9ca3af;">El c&oacute;digo expira en 24 horas.</p>
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="border-top:1px solid #e5e7eb;padding-top:24px;" align="center">
                                <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">Si no creaste una cuenta en Pesito, ignor&aacute; este email.<br/>&mdash; El equipo de Pesito</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
            """.replace("{code}", code);
    }

    private String buildPasswordResetHtml(String code) {
        return """
            <!DOCTYPE html>
            <html lang="es">
            <body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;">
                <tr>
                  <td align="center" style="padding:40px 16px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:440px;background-color:#ffffff;border-radius:16px;border:1px solid #e5e7eb;">
                      <tr>
                        <td align="center" style="padding:40px 32px;">
                          <p style="margin:0 0 24px;font-size:24px;font-weight:700;color:#111827;">&#128184; Pesito</p>
                          <p style="margin:0 0 8px;font-size:20px;font-weight:600;color:#111827;">Restablec&eacute; tu contrase&ntilde;a</p>
                          <p style="margin:0 0 28px;font-size:14px;color:#6b7280;line-height:1.6;">Ingres&aacute; este c&oacute;digo en la app para elegir una nueva contrase&ntilde;a:</p>
                          <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 28px;">
                            <tr>
                              <td style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px 32px;">
                                <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#2563eb;font-family:'Courier New',Courier,monospace;">{code}</span>
                              </td>
                            </tr>
                          </table>
                          <p style="margin:0 0 28px;font-size:13px;color:#9ca3af;">El c&oacute;digo expira en 1 hora.</p>
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="border-top:1px solid #e5e7eb;padding-top:24px;" align="center">
                                <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">Si no pediste restablecer tu contrase&ntilde;a, ignor&aacute; este email. Tu contrase&ntilde;a actual seguir&aacute; funcionando.<br/>&mdash; El equipo de Pesito</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
            """.replace("{code}", code);
    }
}
