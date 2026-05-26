import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests d'integration unitaire de `sendAlerteEmail`.
 *
 * On mocke `./emailService.sendEmail` pour intercepter les calls et
 * verifier le payload (subject + html + text + recipients). Le but est
 * de garantir :
 *   - Comportement no-op si pas de destinataire (RGPD : pas d'email vide).
 *   - Propagation correcte du Result error en cas d'echec transport.
 *   - Pas de fuite XSS via les champs metier (equipement, boutique,
 *     commentaire) interpole dans le HTML.
 *   - Format temperature `-X.X degC` (decision UX HACCP).
 */

const sendEmailMock = vi.fn();

vi.mock('./emailService', () => ({
  sendEmail: sendEmailMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const BASE_FIELDS = {
  equipementNom: 'Congelateur A',
  boutiqueNom: 'MG Paris 11',
  creneau: 'MATIN' as const,
  dateISO: '2026-05-26',
  temperature: -10.5,
  seuilMin: -25,
  seuilMax: -18,
  commentaire: null,
  alerteUrl: 'https://haccp.example.com/alertes/abc',
} as const;

describe('[email-alerte.service] sendAlerteEmail', () => {
  it('should return success and NOT call sendEmail when recipients is empty', async () => {
    const { sendAlerteEmail } = await import('./email-alerte.service');

    const result = await sendAlerteEmail({
      ...BASE_FIELDS,
      recipients: [],
    });

    expect(result).toEqual({ success: true });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('should call sendEmail with the recipients array, subject and rendered html/text', async () => {
    sendEmailMock.mockResolvedValue({ success: true, messageId: 'em-1' });
    const { sendAlerteEmail } = await import('./email-alerte.service');

    const result = await sendAlerteEmail({
      ...BASE_FIELDS,
      recipients: ['boss1@maison-givre.fr', 'boss2@maison-givre.fr'],
    });

    expect(result).toEqual({ success: true });
    expect(sendEmailMock).toHaveBeenCalledTimes(1);

    const args = sendEmailMock.mock.calls[0]?.[0];
    expect(args.to).toEqual(['boss1@maison-givre.fr', 'boss2@maison-givre.fr']);
    expect(args.subject).toContain('Congelateur A');
    expect(args.subject).toContain('MG Paris 11');
    expect(args.subject).toContain('Alerte');
    expect(args.html).toContain('Congelateur A');
    expect(args.html).toContain('MG Paris 11');
    expect(args.html).toContain('-10.5 degC');
    expect(args.html).toContain('-25.0');
    expect(args.html).toContain('-18.0');
    expect(args.text).toContain('Congelateur A');
    expect(args.text).toContain('-10.5 degC');
  });

  it('should propagate transport failure as Result.error', async () => {
    sendEmailMock.mockResolvedValue({
      success: false,
      error: 'SMTP refused',
    });
    const { sendAlerteEmail } = await import('./email-alerte.service');

    const result = await sendAlerteEmail({
      ...BASE_FIELDS,
      recipients: ['boss@maison-givre.fr'],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('SMTP refused');
    }
  });

  it('should fall back to "Unknown error" if transport returns success=false without error', async () => {
    sendEmailMock.mockResolvedValue({ success: false });
    const { sendAlerteEmail } = await import('./email-alerte.service');

    const result = await sendAlerteEmail({
      ...BASE_FIELDS,
      recipients: ['boss@maison-givre.fr'],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Unknown error');
    }
  });

  it('should escape HTML in equipementNom to neutralize XSS payloads', async () => {
    sendEmailMock.mockResolvedValue({ success: true, messageId: 'em-1' });
    const { sendAlerteEmail } = await import('./email-alerte.service');

    await sendAlerteEmail({
      ...BASE_FIELDS,
      equipementNom: '<script>alert(1)</script>',
      recipients: ['boss@maison-givre.fr'],
    });

    const args = sendEmailMock.mock.calls[0]?.[0];
    expect(args.html).not.toContain('<script>');
    expect(args.html).not.toContain('</script>');
    expect(args.html).toContain('&lt;script&gt;');
    expect(args.html).toContain('&lt;/script&gt;');
    // Le text est plain : le payload brut y reste (pas de risque, pas de rendu HTML)
    expect(args.text).toContain('<script>alert(1)</script>');
  });

  it('should escape HTML in boutiqueNom to neutralize XSS payloads', async () => {
    sendEmailMock.mockResolvedValue({ success: true, messageId: 'em-1' });
    const { sendAlerteEmail } = await import('./email-alerte.service');

    await sendAlerteEmail({
      ...BASE_FIELDS,
      boutiqueNom: '"><img src=x onerror=alert(1)>',
      recipients: ['boss@maison-givre.fr'],
    });

    const args = sendEmailMock.mock.calls[0]?.[0];
    expect(args.html).not.toContain('"><img');
    expect(args.html).toContain('&quot;&gt;&lt;img');
  });

  it('should escape HTML in commentaire to neutralize XSS payloads', async () => {
    sendEmailMock.mockResolvedValue({ success: true, messageId: 'em-1' });
    const { sendAlerteEmail } = await import('./email-alerte.service');

    await sendAlerteEmail({
      ...BASE_FIELDS,
      commentaire: '<b>panne</b>',
      recipients: ['boss@maison-givre.fr'],
    });

    const args = sendEmailMock.mock.calls[0]?.[0];
    expect(args.html).not.toContain('<b>panne</b>');
    expect(args.html).toContain('&lt;b&gt;panne&lt;/b&gt;');
  });

  it('should format temperature as "X.X degC" with one decimal', async () => {
    sendEmailMock.mockResolvedValue({ success: true, messageId: 'em-1' });
    const { sendAlerteEmail } = await import('./email-alerte.service');

    await sendAlerteEmail({
      ...BASE_FIELDS,
      temperature: -5,
      recipients: ['boss@maison-givre.fr'],
    });

    const args = sendEmailMock.mock.calls[0]?.[0];
    expect(args.html).toContain('-5.0 degC');
    expect(args.text).toContain('-5.0 degC');
  });

  it('should format dateISO via formatDateShort (DD/MM/YYYY)', async () => {
    sendEmailMock.mockResolvedValue({ success: true, messageId: 'em-1' });
    const { sendAlerteEmail } = await import('./email-alerte.service');

    await sendAlerteEmail({
      ...BASE_FIELDS,
      dateISO: '2026-05-26',
      recipients: ['boss@maison-givre.fr'],
    });

    const args = sendEmailMock.mock.calls[0]?.[0];
    expect(args.html).toContain('26/05/2026');
    expect(args.text).toContain('26/05/2026');
  });

  it('should render the creneau label via CRENEAU_LABELS (e.g. MIDI -> "Midi")', async () => {
    sendEmailMock.mockResolvedValue({ success: true, messageId: 'em-1' });
    const { sendAlerteEmail } = await import('./email-alerte.service');

    await sendAlerteEmail({
      ...BASE_FIELDS,
      creneau: 'MIDI',
      recipients: ['boss@maison-givre.fr'],
    });

    const args = sendEmailMock.mock.calls[0]?.[0];
    expect(args.html).toContain('Midi');
    expect(args.text).toContain('Midi');
  });

  it('should swallow a transport throw and return Result.error (best-effort)', async () => {
    sendEmailMock.mockRejectedValueOnce(new Error('boom'));
    const { sendAlerteEmail } = await import('./email-alerte.service');

    const result = await sendAlerteEmail({
      ...BASE_FIELDS,
      recipients: ['boss@maison-givre.fr'],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('boom');
    }
  });

  it('should return error="Unknown error" when transport throws a non-Error value', async () => {
    sendEmailMock.mockRejectedValueOnce('plain-string');
    const { sendAlerteEmail } = await import('./email-alerte.service');

    const result = await sendAlerteEmail({
      ...BASE_FIELDS,
      recipients: ['boss@maison-givre.fr'],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Unknown error');
    }
  });
});
