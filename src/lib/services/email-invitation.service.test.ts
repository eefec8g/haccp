import { describe, it, expect, vi, beforeEach } from 'vitest';

const sendEmailMock = vi.fn();

vi.mock('./emailService', () => ({
  sendEmail: sendEmailMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('[email-invitation.service]', () => {
  it('should send the email with subject + html + text built from args', async () => {
    sendEmailMock.mockResolvedValue({ success: true, messageId: 'em-1' });
    const { sendUserInvitationEmail } =
      await import('./email-invitation.service');

    const result = await sendUserInvitationEmail({
      to: 'newbie@example.com',
      inviteUrl: 'https://example.com/accept/abc',
      expiresAt: new Date('2026-06-01T12:00:00Z'),
      role: 'RESPONSABLE',
      inviterName: 'Alice',
    });

    expect(result).toEqual({ success: true });
    const args = sendEmailMock.mock.calls[0]?.[0];
    expect(args.to).toBe('newbie@example.com');
    expect(args.subject).toContain('Invitation');
    expect(args.html).toContain('https://example.com/accept/abc');
    expect(args.html).toContain('Responsable');
    expect(args.html).toContain('Alice');
    expect(args.text).toContain('https://example.com/accept/abc');
  });

  it('should escape HTML in inviterName to defuse XSS in the invitation email', async () => {
    sendEmailMock.mockResolvedValue({ success: true, messageId: 'em-1' });
    const { sendUserInvitationEmail } =
      await import('./email-invitation.service');

    const result = await sendUserInvitationEmail({
      to: 'newbie@example.com',
      inviteUrl: 'https://example.com/accept/abc',
      expiresAt: new Date('2026-06-01T12:00:00Z'),
      role: 'SALARIE',
      inviterName: '<script>alert(1)</script>',
    });

    expect(result).toEqual({ success: true });
    const args = sendEmailMock.mock.calls[0]?.[0];
    // Le tag brut <script> NE doit PAS se retrouver dans le HTML.
    expect(args.html).not.toContain('<script>');
    expect(args.html).not.toContain('</script>');
    // La version escaped doit etre presente.
    expect(args.html).toContain('&lt;script&gt;');
    expect(args.html).toContain('&lt;/script&gt;');
  });

  it('should propagate transport errors as Result.error', async () => {
    sendEmailMock.mockResolvedValue({
      success: false,
      error: 'rate limit',
    });
    const { sendUserInvitationEmail } =
      await import('./email-invitation.service');

    const result = await sendUserInvitationEmail({
      to: 'x@example.com',
      inviteUrl: 'https://example.com/accept/xx',
      expiresAt: new Date(Date.now() + 60_000),
      role: 'ADMIN',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('rate limit');
    }
  });
});
