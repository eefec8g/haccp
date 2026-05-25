import { describe, it, expect, vi, beforeEach } from 'vitest';

const sendMock = vi.fn();

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.RESEND_API_KEY = 'test-key';
});

describe('[email-invitation.service]', () => {
  it('should return error when RESEND_API_KEY is missing', async () => {
    delete process.env.RESEND_API_KEY;
    vi.resetModules();
    const { sendUserInvitationEmail } =
      await import('./email-invitation.service');

    const result = await sendUserInvitationEmail({
      to: 'newbie@example.com',
      inviteUrl: 'https://example.com/accept/xxx',
      expiresAt: new Date(Date.now() + 60_000),
      role: 'SALARIE',
    });

    expect(result.success).toBe(false);
  });

  it('should send the email with subject + html + text built from args', async () => {
    sendMock.mockResolvedValue({ data: { id: 'em-1' }, error: null });
    vi.resetModules();
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
    const args = sendMock.mock.calls[0]?.[0];
    expect(args.to).toBe('newbie@example.com');
    expect(args.subject).toContain('Invitation');
    expect(args.html).toContain('https://example.com/accept/abc');
    expect(args.html).toContain('Responsable');
    expect(args.html).toContain('Alice');
    expect(args.text).toContain('https://example.com/accept/abc');
  });

  it('should escape HTML in inviterName to defuse XSS in the invitation email', async () => {
    sendMock.mockResolvedValue({ data: { id: 'em-1' }, error: null });
    vi.resetModules();
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
    const args = sendMock.mock.calls[0]?.[0];
    // Le tag brut <script> NE doit PAS se retrouver dans le HTML.
    expect(args.html).not.toContain('<script>');
    expect(args.html).not.toContain('</script>');
    // La version escaped doit etre presente.
    expect(args.html).toContain('&lt;script&gt;');
    expect(args.html).toContain('&lt;/script&gt;');
  });

  it('should propagate Resend API errors as Result.error', async () => {
    sendMock.mockResolvedValue({
      data: null,
      error: { name: 'send_error', message: 'rate limit' },
    });
    vi.resetModules();
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
