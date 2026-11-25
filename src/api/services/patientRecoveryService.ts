import { randomInt, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import nodemailer from 'nodemailer';
import type { Document } from 'mongodb';
import { getMongoDb } from './mongoService.ts';
import { RECOVERY_QUESTIONS, type RecoveryQuestion } from '../../utils/recoveryQuestions.ts';

const scrypt = promisify(scryptCallback);
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_INTERVAL_MS = 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

interface StoredRecoveryRecord extends Document {
  email: string;
  question: RecoveryQuestion;
  answerSalt: string;
  answerHash: string;
  updatedAt: Date;
}

interface ActiveOtp {
  codeHash: string;
  expiresAt: number;
  attempts: number;
}

const activeOtps = new Map<string, ActiveOtp>();
const lastOtpSentAt = new Map<string, number>();
const recoveryAnswerAttempts = new Map<string, { attempts: number; resetAt: number }>();

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const normalizeAnswer = (answer: string) => answer.trim().normalize('NFKC').toLocaleLowerCase('en');

async function getRecoveryCollection() {
  const db = await getMongoDb();
  if (!db) throw new Error('Recovery storage is unavailable. Configure MongoDB and try again.');
  const collection = db.collection<StoredRecoveryRecord>('patient_recovery');
  await collection.createIndex({ email: 1 }, { unique: true });
  return collection;
}

async function hashAnswer(answer: string, salt: string): Promise<Buffer> {
  return (await scrypt(normalizeAnswer(answer), salt, 64)) as Buffer;
}

export async function savePatientRecoverySetup(
  emailInput: string,
  question: string,
  answer: string
): Promise<void> {
  if (!RECOVERY_QUESTIONS.includes(question as RecoveryQuestion)) {
    throw new Error('Choose a valid recovery question.');
  }
  if (normalizeAnswer(answer).length < 2 || normalizeAnswer(answer).length > 100) {
    throw new Error('Recovery answer must be between 2 and 100 characters.');
  }

  const email = normalizeEmail(emailInput);
  const salt = randomBytes(16).toString('hex');
  const answerHash = (await hashAnswer(answer, salt)).toString('hex');
  await (await getRecoveryCollection()).updateOne(
    { email },
    { $set: { email, question: question as RecoveryQuestion, answerSalt: salt, answerHash, updatedAt: new Date() } },
    { upsert: true }
  );
}

export async function getPatientRecoveryQuestion(emailInput: string): Promise<string | null> {
  const record = await (await getRecoveryCollection()).findOne({ email: normalizeEmail(emailInput) });
  return record?.question || null;
}

export async function sendPatientRecoveryOtp(emailInput: string, answer: string): Promise<void> {
  const email = normalizeEmail(emailInput);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid registered email address.');
  const now = Date.now();
  const answerAttempt = recoveryAnswerAttempts.get(email);
  if (answerAttempt && answerAttempt.resetAt > now && answerAttempt.attempts >= MAX_OTP_ATTEMPTS) {
    throw new Error('Too many recovery attempts. Wait 15 minutes and try again.');
  }

  const lastSent = lastOtpSentAt.get(email) || 0;
  if (now - lastSent < OTP_RESEND_INTERVAL_MS) {
    throw new Error('Please wait a minute before requesting another code.');
  }

  const record = await (await getRecoveryCollection()).findOne({ email });
  if (!record || !answer.trim()) throw new Error('The email or recovery answer is incorrect.');
  const expectedHash = Buffer.from(record.answerHash, 'hex');
  const receivedHash = await hashAnswer(answer, record.answerSalt);
  if (expectedHash.length !== receivedHash.length || !timingSafeEqual(expectedHash, receivedHash)) {
    if (!answerAttempt || answerAttempt.resetAt <= now) {
      recoveryAnswerAttempts.set(email, { attempts: 1, resetAt: now + 15 * 60 * 1000 });
    } else {
      answerAttempt.attempts += 1;
    }
    throw new Error('The email or recovery answer is incorrect.');
  }
  recoveryAnswerAttempts.delete(email);

  const user = process.env.EMAIL_USER?.trim();
  const pass = process.env.EMAIL_PASS;
  if (!user || !pass) {
    throw new Error('Email delivery is not configured. Set EMAIL_USER and EMAIL_PASS on the server.');
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const transport = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });

  try {
    await transport.verify();
    await transport.sendMail({
      from: { name: 'Medi Queue', address: user },
      to: email,
      subject: 'Your Medi Queue password recovery code',
      text: [
        'Medi Queue password recovery',
        '',
        `Your verification code is ${code}.`,
        'This code expires in 10 minutes.',
        '',
        'If you did not request a password reset, you can ignore this message. Do not share this code with anyone.',
        'Medi Queue Support',
      ].join('\n'),
      html: `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f3faf6;font-family:Arial,Helvetica,sans-serif;color:#173b40">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px;background:#f3faf6">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #dcebe3;border-radius:16px;overflow:hidden">
          <tr><td style="padding:24px 28px;background:#087f78;color:#ffffff;font-size:22px;font-weight:700">Medi Queue</td></tr>
          <tr><td style="padding:28px">
            <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#173b40">Password recovery</h1>
            <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#526b67">Use this verification code to continue resetting your password.</p>
            <div style="padding:18px;background:#eff8f3;border:1px solid #cde9d8;border-radius:12px;text-align:center;font-size:32px;font-weight:700;letter-spacing:8px;color:#087f78">${code}</div>
            <p style="margin:18px 0 0;font-size:14px;line-height:1.6;color:#526b67">This code expires in <strong>10 minutes</strong>. For your security, do not share it with anyone.</p>
            <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#718581">If you did not request this reset, you can ignore this email. Your password will not change.</p>
          </td></tr>
          <tr><td style="padding:16px 28px;background:#f8fbf9;border-top:1px solid #e5efea;font-size:12px;color:#718581">Medi Queue Support</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`,
    });
  } catch (error: any) {
    console.error('Patient recovery email delivery failed', {
      code: error?.code || 'SMTP_ERROR',
      responseCode: error?.responseCode,
    });
    throw new Error('Could not deliver the recovery email. Check the Gmail App Password and server email access.');
  } finally {
    transport.close();
  }

  const codeHash = (await scrypt(code, email, 64) as Buffer).toString('hex');
  activeOtps.set(email, { codeHash, expiresAt: now + OTP_TTL_MS, attempts: 0 });
  lastOtpSentAt.set(email, now);
}

export async function verifyPatientRecoveryOtp(emailInput: string, codeInput: string): Promise<boolean> {
  const email = normalizeEmail(emailInput);
  const activeOtp = activeOtps.get(email);
  if (!activeOtp || Date.now() > activeOtp.expiresAt || activeOtp.attempts >= MAX_OTP_ATTEMPTS) {
    activeOtps.delete(email);
    return false;
  }

  const code = codeInput.trim();
  if (!/^\d{6}$/.test(code)) {
    activeOtp.attempts += 1;
    return false;
  }
  const expectedHash = Buffer.from(activeOtp.codeHash, 'hex');
  const receivedHash = (await scrypt(code, email, 64)) as Buffer;
  if (expectedHash.length !== receivedHash.length || !timingSafeEqual(expectedHash, receivedHash)) {
    activeOtp.attempts += 1;
    if (activeOtp.attempts >= MAX_OTP_ATTEMPTS) activeOtps.delete(email);
    return false;
  }

  activeOtps.delete(email);
  lastOtpSentAt.delete(email);
  return true;
}
