import nodemailer from 'nodemailer';
import * as XLSX from 'xlsx';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { TransactionData } from '../types';

class EmailService {
    private transporter: nodemailer.Transporter | null = null;

    // Helper function to create password-protected ZIP files
    private async createPasswordProtectedZip(
        fileBuffer: Buffer,
        filename: string
    ): Promise<Buffer> {
        const execAsync = promisify(exec);

        try {
            // Create temporary directory and files
            const tempDir = path.join(__dirname, '../temp');
            const tempFilePath = path.join(tempDir, filename);
            const tempZipPath = path.join(tempDir, 'temp_' + Date.now() + '.zip');

            // Ensure temp directory exists
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            // Write file to temp directory
            fs.writeFileSync(tempFilePath, fileBuffer);

            // Create password-protected ZIP using system zip command
            // Use -j flag to junk (ignore) directory paths and only zip the file
            const zipCommand = `zip -j -P "stripe2024!" "${tempZipPath}" "${tempFilePath}"`;
            await execAsync(zipCommand);

            // Read the ZIP file
            const zipBuffer = fs.readFileSync(tempZipPath);

            // Clean up temporary files
            fs.unlinkSync(tempFilePath);
            fs.unlinkSync(tempZipPath);

            return zipBuffer;
        } catch (error) {
            console.error('Error creating password-protected ZIP:', error);
            throw new Error('Failed to create password-protected ZIP file');
        }
    }

    private createTransporter(): nodemailer.Transporter {
        // Create transporter using environment variables
        return nodemailer.createTransport({
            host: process.env['SMTP_HOST'] || 'smtp.gmail.com',
            port: parseInt(process.env['SMTP_PORT'] || '587'),
            secure: false, // true for 465, false for other ports
            auth: {
                user: process.env['SMTP_USER']?.trim(),
                pass: process.env['SMTP_PASS']?.trim(),
            },
            tls: {
                rejectUnauthorized: false,
            },
        });
    }

    private getTransporter(): nodemailer.Transporter {
        if (!this.transporter) {
            this.transporter = this.createTransporter();
        }
        return this.transporter;
    }

    private generateExcelBuffer(transactions: TransactionData[]): Buffer {
        // Generate Excel data with account ID column
        const excelData = transactions.map(tx => ({
            'Account ID': tx.account_id || 'N/A',
            Date: tx.date,
            'Charges Count': tx.charges_count || 0,
            'Charges Amount': (tx.charges_amount / 100).toFixed(2),
            'Refunds Count': tx.refunds_count || 0,
            'Refunds Amount': (tx.refunds_amount / 100).toFixed(2),
            'Chargebacks Count': tx.chargebacks_count || 0,
            'Chargebacks Amount': (tx.chargebacks_amount / 100).toFixed(2),
            'Declines Count': tx.declines_count || 0,
            'Approval %': tx.aprvl_pct ? `${tx.aprvl_pct.toFixed(2)}%` : 'N/A',
            'Total Count': tx.totals_count || 0,
            'Total Amount': (tx.totals_amount / 100).toFixed(2),
        }));

        // Create workbook and worksheet
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Stripe Report');

        // Generate Excel buffer
        return XLSX.write(workbook, {
            bookType: 'xlsx',
            type: 'buffer',
        });
    }

    private generateEmailHTML(reportInfo: {
        startDate: string;
        endDate: string;
        timezone: string;
        accountCount: number;
    }): string {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Stripe Connect Report</title>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .header { background: #6772e5; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; }
                    .summary { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
                    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📊 Stripe Connect Report</h1>
                </div>

                <div class="content">
                    <p>Hello,</p>

                    <p>Your Stripe Connect report has been generated and is attached to this email.</p>

                    <div class="summary">
                        <h3>Report Summary:</h3>
                        <ul>
                            <li><strong>Date Range:</strong> ${reportInfo.startDate} to ${reportInfo.endDate}</li>
                            <li><strong>Timezone:</strong> ${reportInfo.timezone}</li>
                            <li><strong>Accounts:</strong> ${reportInfo.accountCount}</li>
                        </ul>
                    </div>

                    <p>The report is attached as a password-protected ZIP file (.zip) for your security.</p>
                    <p>Please contact your administrator for the password to extract the Excel report inside.</p>

                    <p>If you have any questions about this report, please don't hesitate to contact us.</p>

                    <p>Best regards,<br>Stripe Connect Reporting Team</p>
                </div>

                <div class="footer">
                    <p>This is an automated report from your Stripe Connect Reporting system.</p>
                </div>
            </body>
            </html>
        `;
    }

    async sendStripeReport(
        toEmail: string,
        transactions: TransactionData[],
        reportInfo: {
            startDate: string;
            endDate: string;
            timezone: string;
            accountCount: number;
        }
    ): Promise<boolean> {
        try {
            // Generate Excel file first
            const excelBuffer = this.generateExcelBuffer(transactions);

            // Create password-protected ZIP file containing the Excel
            const zipBuffer = await this.createPasswordProtectedZip(
                excelBuffer,
                `stripe-report-${reportInfo.startDate}-${reportInfo.endDate}.xlsx`
            );

            // Create email content
            const subject = `Stripe Connect Report - ${reportInfo.startDate} to ${reportInfo.endDate}`;
            const htmlContent = this.generateEmailHTML(reportInfo);

            // Send email with password-protected ZIP attachment
            const mailOptions = {
                from: process.env['SMTP_USER'],
                to: toEmail,
                subject: subject,
                html: htmlContent,
                attachments: [
                    {
                        filename: `stripe-report-${reportInfo.startDate}-${reportInfo.endDate}-PROTECTED.zip`,
                        content: zipBuffer,
                        contentType: 'application/zip',
                    },
                ],
                text: `Your Stripe Connect report is attached as a password-protected ZIP file. Please contact your administrator for the password to extract the Excel file inside.`,
            };

            await this.getTransporter().sendMail(mailOptions);
            return true;
        } catch (error) {
            console.error('Failed to send email:', error);
            return false;
        }
    }

    async sendDetailedTransactionsEmail(
        toEmail: string,
        startDate: string,
        endDate: string,
        timezone: string,
        csvContent: string,
        transactionCount: number
    ): Promise<boolean> {
        try {
            // Create password-protected ZIP file containing the CSV
            const zipBuffer = await this.createPasswordProtectedZip(
                Buffer.from(csvContent, 'utf8'),
                `stripe-detailed-transactions-${startDate}-${endDate}.csv`
            );

            // Create email content
            const subject = `Stripe Detailed Transactions Report - ${startDate} to ${endDate}`;
            const htmlContent = `
                <html>
                    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                            <h2 style="color: #635bff;">Stripe Detailed Transactions Report</h2>
                            
                            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                                <h3 style="margin-top: 0; color: #495057;">Report Details</h3>
                                <p><strong>Date Range:</strong> ${startDate} to ${endDate}</p>
                                <p><strong>Timezone:</strong> ${timezone}</p>
                                <p><strong>Total Transactions:</strong> ${transactionCount}</p>
                                <p><strong>Report Type:</strong> Detailed Transaction Data</p>
                            </div>

                            <div style="background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
                                <h3 style="margin-top: 0; color: #1976d2;">Data Included</h3>
                                <ul style="margin: 0;">
                                    <li>Individual transaction records</li>
                                    <li>Customer IP addresses</li>
                                    <li>Decline reasons and failure codes</li>
                                    <li>Risk levels and processor status</li>
                                    <li>Fraud details and compliance data</li>
                                    <li>Complete audit trail information</li>
                                </ul>
                            </div>

                            <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
                                <h3 style="margin-top: 0; color: #856404;">Security Notice</h3>
                                <p style="margin: 0;">This file is password-protected for security. Please contact your administrator for the password to extract the CSV file.</p>
                            </div>

                            <p style="margin-top: 30px; font-size: 14px; color: #6c757d;">
                                This report was generated automatically by the Stripe Connect Reporting System.
                            </p>
                        </div>
                    </body>
                </html>
            `;

            // Send email with password-protected ZIP attachment
            const mailOptions = {
                from: process.env['SMTP_USER'],
                to: toEmail,
                subject: subject,
                html: htmlContent,
                attachments: [
                    {
                        filename: `stripe-detailed-transactions-${startDate}-${endDate}-PROTECTED.csv.zip`,
                        content: zipBuffer,
                        contentType: 'application/zip',
                    },
                ],
                text: `Your Stripe Detailed Transactions report is attached as a password-protected ZIP file. Please contact your administrator for the password to extract the CSV file inside.`,
            };

            await this.getTransporter().sendMail(mailOptions);
            return true;
        } catch (error) {
            console.error('Failed to send detailed transactions email:', error);
            return false;
        }
    }
}

export default new EmailService();
