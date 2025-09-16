import { Router, Response } from 'express';
import { validateJWT, validateStripeKeys } from '../middleware/auth';
import stripeService from '../services/stripeService';
import emailService from '../services/emailService';
import XLSX from 'xlsx';
import PDFDocument from 'pdfkit';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import moment from 'moment';
import { AuthenticatedRequest } from '../types';
import { pool } from '../utils/dbconfig';

const router = Router();

// Helper function to create truly password-protected ZIP files using system zip command
async function createPasswordProtectedZip(
    fileBuffer: Buffer,
    filename: string,
    password: string
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
        let zipCommand: string;

        if (process.platform === 'win32') {
            // Use PowerShell Compress-Archive on Windows (note: this doesn't support password protection)
            // For now, we'll use a simple zip without password on Windows
            zipCommand = `powershell -command "Compress-Archive -Path '${tempFilePath}' -DestinationPath '${tempZipPath}' -Force"`;
        } else {
            // Use zip command on Unix systems
            zipCommand = `zip -j -P "${password}" "${tempZipPath}" "${tempFilePath}"`;
        }

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

// Helper function to create password-protected PDF report
async function createPdfReport(
    transactions: any[],
    startDate: string,
    endDate: string,
    password: string
): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                layout: 'landscape', // Use landscape for better table display
                margins: {
                    top: 50,
                    bottom: 50,
                    left: 50,
                    right: 50,
                },
                // Add password protection directly to PDF
                userPassword: password,
                ownerPassword: password,
                permissions: {
                    printing: 'highResolution',
                    modifying: false,
                    copying: false,
                    annotating: false,
                    fillingForms: false,
                    contentAccessibility: false,
                    documentAssembly: false,
                },
            });

            const chunks: Buffer[] = [];
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => {
                const pdfBuffer = Buffer.concat(chunks);
                resolve(pdfBuffer);
            });

            // Add header
            doc.fontSize(20)
                .font('Helvetica-Bold')
                .text('Stripe Connect Report', { align: 'center' });

            doc.moveDown();
            doc.fontSize(12)
                .font('Helvetica')
                .text(`Report Period: ${startDate} to ${endDate}`, { align: 'center' });

            doc.moveDown();
            doc.text(`Generated on: ${moment().format('YYYY-MM-DD HH:mm:ss UTC')}`, {
                align: 'center',
            });

            doc.moveDown(2);

            doc.moveDown(2);

            // Add detailed table
            doc.fontSize(14).font('Helvetica-Bold').text('Detailed Transaction Details');

            doc.moveDown();

            // Table headers with comprehensive data
            const headers = [
                'Date',
                'Account ID',
                'Charges Count',
                'Charges Amount',
                'Refunds Count',
                'Refunds Amount',
                'Total Count',
                'Total Amount',
            ];
            const pageWidth = doc.page.width - 100; // Leave 50px margin on each side
            const columnWidths = [
                pageWidth * 0.12, // Date: 12%
                pageWidth * 0.2, // Account ID: 20%
                pageWidth * 0.12, // Charges Count: 12%
                pageWidth * 0.14, // Charges Amount: 14%
                pageWidth * 0.12, // Refunds Count: 12%
                pageWidth * 0.14, // Refunds Amount: 14%
                pageWidth * 0.08, // Total Count: 8%
                pageWidth * 0.08, // Total Amount: 8%
            ];
            const startX = 50;
            let currentY = doc.y;

            const headerRowHeight = 30; // fixed height to avoid overlap

            doc.fontSize(10).font('Helvetica-Bold').fillColor('black');

            // Draw headers
            headers.forEach((header, index) => {
                const x =
                    startX + columnWidths.slice(0, index).reduce((sum, width) => sum + width, 0);
                doc.text(header, x + 5, currentY + 5, {
                    width: columnWidths[index] - 10,
                });
            });

            // Draw horizontal line just below header
            doc.moveTo(startX, currentY + headerRowHeight)
                .lineTo(
                    startX + columnWidths.reduce((sum, w) => sum + w, 0),
                    currentY + headerRowHeight
                )
                .stroke();

            // Move Y position for table rows
            currentY += headerRowHeight + 5;

            // Draw data rows with proper pagination
            doc.fontSize(9).font('Helvetica').fillColor('black');

            transactions.forEach((tx, rowIndex) => {
                // Check if we need a new page (leave 50px margin at bottom)
                if (currentY > doc.page.height - 100) {
                    doc.addPage();
                    currentY = 50;

                    // Redraw header on new page
                    doc.fontSize(10).font('Helvetica-Bold').fillColor('white');
                    headers.forEach((header, index) => {
                        const x =
                            startX +
                            columnWidths.slice(0, index).reduce((sum, width) => sum + width, 0);
                        doc.rect(x, currentY, columnWidths[index], 20).fill();
                        doc.fillColor('gray').text(header, x + 5, currentY + 5, {
                            width: columnWidths[index] - 10,
                        });
                    });
                    currentY += 25;
                    doc.fontSize(9).font('Helvetica').fillColor('black');
                }

                const rowData = [
                    tx.date,
                    tx.account_id || 'N/A',
                    tx.charges_count || 0,
                    `$${(tx.charges_amount / 100).toFixed(2)}`,
                    tx.refunds_count || 0,
                    `$${(tx.refunds_amount / 100).toFixed(2)}`,
                    tx.totals_count || 0,
                    `$${(tx.totals_amount / 100).toFixed(2)}`,
                ];

                // Alternate row colors
                if (rowIndex % 2 === 0) {
                    doc.fillColor('#f0f0f0');
                    doc.rect(
                        startX,
                        currentY,
                        columnWidths.reduce((sum, width) => sum + width, 0),
                        20
                    ).fill();
                    doc.fillColor('black');
                }

                rowData.forEach((cell, index) => {
                    const x =
                        startX +
                        columnWidths.slice(0, index).reduce((sum, width) => sum + width, 0);
                    doc.text(cell, x + 5, currentY + 5, { width: columnWidths[index] - 10 });
                });

                currentY += 20;
            });

            // Add footer with page count
            doc.addPage();
            doc.fontSize(10)
                .font('Helvetica')
                .text('This report contains sensitive financial data and is password protected.', {
                    align: 'center',
                });

            doc.moveDown();
            doc.text('For questions about this report, please contact your system administrator.', {
                align: 'center',
            });

            doc.moveDown();
            doc.text(`Total pages: ${doc.bufferedPageRange().count}`, {
                align: 'center',
            });

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

// CSV Export endpoint
router.post(
    '/csv/:accountIds',
    validateJWT,
    validateStripeKeys,
    async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
        try {
            const { accountIds } = req.params;
            const { start_date, end_date, timezone = 'UTC', period = 'custom' } = req.body;

            let startDate: string, endDate: string;

            // Handle different period types
            switch (period) {
                case 'daily':
                    startDate = moment().subtract(1, 'day').format('YYYY-MM-DD');
                    endDate = moment().format('YYYY-MM-DD');
                    break;
                case 'weekly':
                    startDate = moment().subtract(7, 'days').format('YYYY-MM-DD');
                    endDate = moment().format('YYYY-MM-DD');
                    break;
                case 'monthly':
                    startDate = moment().subtract(30, 'days').format('YYYY-MM-DD');
                    endDate = moment().format('YYYY-MM-DD');
                    break;
                case 'custom':
                    if (!start_date || !end_date) {
                        return res.status(400).json({
                            error: 'Bad Request',
                            message: 'start_date and end_date are required for custom period',
                        });
                    }
                    startDate = start_date as string;
                    endDate = end_date as string;
                    break;
                default:
                    return res.status(400).json({
                        error: 'Bad Request',
                        message: 'Invalid period. Use: daily, weekly, monthly, or custom',
                    });
            }

            // Validate dates
            if (!moment(startDate).isValid() || !moment(endDate).isValid()) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'Invalid date format. Use YYYY-MM-DD',
                });
            }

            if (moment(startDate).isAfter(moment(endDate))) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'start_date cannot be after end_date',
                });
            }

            // Parse account IDs (comma-separated)
            const accountIdList = accountIds.split(',').map(id => id.trim());
            if (accountIdList.length === 0) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'At least one account ID is required',
                });
            }

            // Get transactions for all accounts
            const { transactions } = await stripeService.getMultiAccountTransactions(
                req.user!.secretKey,
                accountIdList,
                startDate,
                endDate,
                timezone as string
            );

            // Generate CSV with account ID column
            const csvHeaders = [
                'Account ID',
                'Date',
                'Charges Count',
                'Charges Amount',
                'Refunds Count',
                'Refunds Amount',
                'Chargebacks Count',
                'Chargebacks Amount',
                'Declines Count',
                'Approval %',
                'Total Count',
                'Total Amount',
            ];

            const csvRows = transactions.map(tx => [
                tx.account_id || 'N/A',
                tx.date,
                tx.charges_count || 0,
                (tx.charges_amount / 100).toFixed(2),
                tx.refunds_count || 0,
                (tx.refunds_amount / 100).toFixed(2),
                tx.chargebacks_count || 0,
                (tx.chargebacks_amount / 100).toFixed(2),
                tx.declines_count || 0,
                tx.aprvl_pct ? `${tx.aprvl_pct.toFixed(2)}%` : 'N/A',
                tx.totals_count || 0,
                (tx.totals_amount / 100).toFixed(2),
            ]);

            const csvContent = [csvHeaders, ...csvRows]
                .map(row => row.map(cell => `"${cell}"`).join(','))
                .join('\n');

            // Create password-protected ZIP file containing the CSV file
            const zipPassword = 'stripe2024!';
            const csvBuffer = Buffer.from(csvContent, 'utf-8');
            const zipBuffer = await createPasswordProtectedZip(
                csvBuffer,
                `stripe-report-${startDate}-${endDate}.csv`,
                zipPassword
            );

            // Send ZIP file directly as binary download
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader(
                'Content-Disposition',
                `attachment; filename="stripe-report-${startDate}-${endDate}-PROTECTED.csv.zip"`
            );
            res.setHeader('Content-Length', zipBuffer.length.toString());

            return res.send(zipBuffer);
        } catch (error) {
            console.error('Error exporting CSV:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to export CSV',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
);

// Excel Export endpoint
router.post(
    '/xls/:accountIds',
    validateJWT,
    validateStripeKeys,
    async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
        try {
            const { accountIds } = req.params;
            const { start_date, end_date, timezone = 'UTC', period = 'custom' } = req.body;

            let startDate: string, endDate: string;

            // Handle different period types
            switch (period) {
                case 'daily':
                    startDate = moment().subtract(1, 'day').format('YYYY-MM-DD');
                    endDate = moment().format('YYYY-MM-DD');
                    break;
                case 'weekly':
                    startDate = moment().subtract(7, 'days').format('YYYY-MM-DD');
                    endDate = moment().format('YYYY-MM-DD');
                    break;
                case 'monthly':
                    startDate = moment().subtract(30, 'days').format('YYYY-MM-DD');
                    endDate = moment().format('YYYY-MM-DD');
                    break;
                case 'custom':
                    if (!start_date || !end_date) {
                        return res.status(400).json({
                            error: 'Bad Request',
                            message: 'start_date and end_date are required for custom period',
                        });
                    }
                    startDate = start_date as string;
                    endDate = end_date as string;
                    break;
                default:
                    return res.status(400).json({
                        error: 'Bad Request',
                        message: 'Invalid period. Use: daily, weekly, monthly, or custom',
                    });
            }

            // Validate dates
            if (!moment(startDate).isValid() || !moment(endDate).isValid()) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'Invalid date format. Use YYYY-MM-DD',
                });
            }

            if (moment(startDate).isAfter(moment(endDate))) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'start_date cannot be after end_date',
                });
            }

            // Parse account IDs (comma-separated)
            const accountIdList = accountIds.split(',').map(id => id.trim());
            if (accountIdList.length === 0) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'At least one account ID is required',
                });
            }

            // Get transactions for all accounts
            const { transactions } = await stripeService.getMultiAccountTransactions(
                req.user!.secretKey,
                accountIdList,
                startDate,
                endDate,
                timezone as string
            );

            // Generate XLS data with account ID column
            const xlsData = transactions.map(tx => ({
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

            // Generate Excel file with XLSX - clean and simple data only
            const worksheet = XLSX.utils.json_to_sheet(xlsData);
            const workbook = XLSX.utils.book_new();

            // Define ZIP password for the ZIP file protection
            const zipPassword = 'stripe2024!';

            XLSX.utils.book_append_sheet(workbook, worksheet, 'Stripe Report');

            // Generate Excel buffer
            const excelBuffer = XLSX.write(workbook, {
                bookType: 'xlsx',
                type: 'buffer',
            });

            // Create password-protected ZIP file containing the Excel file
            const zipBuffer = await createPasswordProtectedZip(
                excelBuffer,
                `stripe-report-${startDate}-${endDate}.xlsx`,
                zipPassword
            );

            // Send ZIP file directly as binary download
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader(
                'Content-Disposition',
                `attachment; filename="stripe-report-${startDate}-${endDate}-PROTECTED.zip"`
            );
            res.setHeader('Content-Length', zipBuffer.length.toString());

            return res.send(zipBuffer);
        } catch (error) {
            console.error('Error exporting XLS:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to export XLS',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
);

// Email export endpoint
router.post(
    '/email/:accountIds',
    validateJWT,
    validateStripeKeys,
    async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
        try {
            const { accountIds } = req.params;
            const { start_date, end_date, timezone = 'UTC', period = 'custom', email } = req.body;

            if (!email) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'Email address is required for email export',
                });
            }

            let startDate: string, endDate: string;

            // Handle different period types
            switch (period) {
                case 'daily':
                    startDate = moment().subtract(1, 'day').format('YYYY-MM-DD');
                    endDate = moment().format('YYYY-MM-DD');
                    break;
                case 'weekly':
                    startDate = moment().subtract(7, 'days').format('YYYY-MM-DD');
                    endDate = moment().format('YYYY-MM-DD');
                    break;
                case 'monthly':
                    startDate = moment().subtract(30, 'days').format('YYYY-MM-DD');
                    endDate = moment().format('YYYY-MM-DD');
                    break;
                case 'custom':
                    if (!start_date || !end_date) {
                        return res.status(400).json({
                            error: 'Bad Request',
                            message: 'start_date and end_date are required for custom period',
                        });
                    }
                    startDate = start_date as string;
                    endDate = end_date as string;
                    break;
                default:
                    return res.status(400).json({
                        error: 'Bad Request',
                        message: 'Invalid period. Use: daily, weekly, monthly, or custom',
                    });
            }

            // Validate dates
            if (!moment(startDate).isValid() || !moment(endDate).isValid()) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'Invalid date format. Use YYYY-MM-DD',
                });
            }

            if (moment(startDate).isAfter(moment(endDate))) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'start_date cannot be after end_date',
                });
            }

            // Parse account IDs (comma-separated)
            const accountIdList = accountIds.split(',').map(id => id.trim());
            if (accountIdList.length === 0) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'At least one account ID is required',
                });
            }

            // Get transactions for all accounts
            const { transactions } = await stripeService.getMultiAccountTransactions(
                req.user!.secretKey,
                accountIdList,
                startDate,
                endDate,
                timezone as string
            );

            // Send email with report attachment
            const emailSent = await emailService.sendStripeReport(email, transactions, {
                startDate,
                endDate,
                timezone: timezone as string,
                accountCount: accountIdList.length,
            });

            if (!emailSent) {
                return res.status(500).json({
                    success: false,
                    error: 'Failed to send email',
                    message: 'Email service is not configured or failed to send the email',
                });
            }

            // Return success response
            return res.json({
                success: true,
                message: `Report with ${transactions.length} daily summaries has been sent to ${email}`,
                data: {
                    email,
                    dailySummaryCount: transactions.length,
                    dateRange: { startDate, endDate },
                    accountIds: accountIdList,
                    totalTransactions: transactions.reduce(
                        (sum, tx) => sum + (tx.totals_count || 0),
                        0
                    ),
                    totalAmount:
                        transactions.reduce((sum, tx) => sum + (tx.totals_amount || 0), 0) / 100,
                },
            });
        } catch (error) {
            console.error('Error exporting to email:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to export to email',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
);

// Google Sheets export endpoint
router.post(
    '/sheets/:accountIds',
    validateJWT,
    validateStripeKeys,
    async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
        try {
            const { accountIds } = req.params;
            const { start_date, end_date, timezone = 'UTC', period = 'custom' } = req.body;

            let startDate: string, endDate: string;

            // Handle different period types
            switch (period) {
                case 'daily':
                    startDate = moment().subtract(1, 'day').format('YYYY-MM-DD');
                    endDate = moment().format('YYYY-MM-DD');
                    break;
                case 'weekly':
                    startDate = moment().subtract(7, 'days').format('YYYY-MM-DD');
                    endDate = moment().format('YYYY-MM-DD');
                    break;
                case 'monthly':
                    startDate = moment().subtract(30, 'days').format('YYYY-MM-DD');
                    endDate = moment().format('YYYY-MM-DD');
                    break;
                case 'custom':
                    if (!start_date || !end_date) {
                        return res.status(400).json({
                            error: 'Bad Request',
                            message: 'start_date and end_date are required for custom period',
                        });
                    }
                    startDate = start_date as string;
                    endDate = end_date as string;
                    break;
                default:
                    return res.status(400).json({
                        error: 'Bad Request',
                        message: 'Invalid period. Use: daily, weekly, monthly, or custom',
                    });
            }

            // Validate dates
            if (!moment(startDate).isValid() || !moment(endDate).isValid()) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'Invalid date format. Use YYYY-MM-DD',
                });
            }

            if (moment(startDate).isAfter(moment(endDate))) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'start_date cannot be after end_date',
                });
            }

            // Parse account IDs (comma-separated)
            const accountIdList = accountIds.split(',').map(id => id.trim());
            if (accountIdList.length === 0) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'At least one account ID is required',
                });
            }

            // Get transactions for all accounts
            const { transactions } = await stripeService.getMultiAccountTransactions(
                req.user!.secretKey,
                accountIdList,
                startDate,
                endDate,
                timezone as string
            );

            // Generate CSV data for Google Sheets import
            const csvHeaders = [
                'Account ID',
                'Date',
                'Charges Count',
                'Charges Amount',
                'Refunds Count',
                'Refunds Amount',
                'Chargebacks Count',
                'Chargebacks Amount',
                'Declines Count',
                'Approval %',
                'Total Count',
                'Total Amount',
            ];

            const csvRows = transactions.map(tx => [
                tx.account_id || 'N/A',
                tx.date,
                tx.charges_count || 0,
                (tx.charges_amount / 100).toFixed(2),
                tx.refunds_count || 0,
                (tx.refunds_amount / 100).toFixed(2),
                tx.chargebacks_count || 0,
                (tx.chargebacks_amount / 100).toFixed(2),
                tx.declines_count || 0,
                tx.aprvl_pct ? `${tx.aprvl_pct.toFixed(2)}%` : 'N/A',
                tx.totals_count || 0,
                (tx.totals_amount / 100).toFixed(2),
            ]);

            const csvContent = [csvHeaders, ...csvRows]
                .map(row => row.map(cell => `"${cell}"`).join(','))
                .join('\n');

            // Create password-protected ZIP file containing the CSV file for Google Sheets
            const zipPassword = 'stripe2024!';
            const csvBuffer = Buffer.from(csvContent, 'utf-8');
            const zipBuffer = await createPasswordProtectedZip(
                csvBuffer,
                `stripe-report-${startDate}-${endDate}-google-sheets.csv`,
                zipPassword
            );

            // Send ZIP file directly as binary download
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader(
                'Content-Disposition',
                `attachment; filename="stripe-report-${startDate}-${endDate}-google-sheets-PROTECTED.zip"`
            );
            res.setHeader('Content-Length', zipBuffer.length.toString());

            return res.send(zipBuffer);
        } catch (error) {
            console.error('Error exporting to Google Sheets:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to export to Google Sheets',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
);

// PDF Export endpoint
router.post(
    '/pdf/:accountIds',
    validateJWT,
    validateStripeKeys,
    async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
        try {
            const { accountIds } = req.params;
            const { start_date, end_date, timezone = 'UTC', period = 'custom' } = req.body;

            let startDate: string, endDate: string;

            // Handle different period types
            switch (period) {
                case 'daily':
                    startDate = moment().subtract(1, 'day').format('YYYY-MM-DD');
                    endDate = moment().format('YYYY-MM-DD');
                    break;
                case 'weekly':
                    startDate = moment().subtract(7, 'days').format('YYYY-MM-DD');
                    endDate = moment().format('YYYY-MM-DD');
                    break;
                case 'monthly':
                    startDate = moment().subtract(30, 'days').format('YYYY-MM-DD');
                    endDate = moment().format('YYYY-MM-DD');
                    break;
                case 'custom':
                    if (!start_date || !end_date) {
                        return res.status(400).json({
                            error: 'Bad Request',
                            message: 'start_date and end_date are required for custom period',
                        });
                    }
                    startDate = start_date as string;
                    endDate = end_date as string;
                    break;
                default:
                    return res.status(400).json({
                        error: 'Bad Request',
                        message: 'Invalid period. Use: daily, weekly, monthly, or custom',
                    });
            }

            // Validate dates
            if (!moment(startDate).isValid() || !moment(endDate).isValid()) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'Invalid date format. Use YYYY-MM-DD',
                });
            }

            if (moment(startDate).isAfter(moment(endDate))) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'start_date cannot be after end_date',
                });
            }

            // Parse account IDs (comma-separated)
            const accountIdList = accountIds.split(',').map(id => id.trim());
            if (accountIdList.length === 0) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'At least one account ID is required',
                });
            }

            // Get transactions for all accounts
            const { transactions } = await stripeService.getMultiAccountTransactions(
                req.user!.secretKey,
                accountIdList,
                startDate,
                endDate,
                timezone as string
            );

            // Generate password-protected PDF report
            const pdfPassword = 'stripe2024!';
            const pdfBuffer = await createPdfReport(transactions, startDate, endDate, pdfPassword);

            // Send password-protected PDF directly as binary download
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader(
                'Content-Disposition',
                `attachment; filename="stripe-report-${startDate}-${endDate}-PROTECTED.pdf"`
            );
            res.setHeader('Content-Length', pdfBuffer.length.toString());

            return res.send(pdfBuffer);
        } catch (error) {
            console.error('Error exporting PDF:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to export PDF',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
);

// Comprehensive Export endpoint with all Stripe endpoints
router.post(
    '/comprehensive/:accountIds',
    validateJWT,
    validateStripeKeys,
    async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
        try {
            const { accountIds } = req.params;
            const { start_date, end_date, timezone = 'UTC', period = 'custom', format = 'xlsx' } = req.body;

            let startDate: string, endDate: string;

            // Handle different period types
            switch (period) {
                case 'daily':
                    startDate = moment().subtract(1, 'day').format('YYYY-MM-DD');
                    endDate = moment().format('YYYY-MM-DD');
                    break;
                case 'weekly':
                    startDate = moment().subtract(7, 'days').format('YYYY-MM-DD');
                    endDate = moment().format('YYYY-MM-DD');
                    break;
                case 'monthly':
                    startDate = moment().subtract(30, 'days').format('YYYY-MM-DD');
                    endDate = moment().format('YYYY-MM-DD');
                    break;
                case 'custom':
                    if (!start_date || !end_date) {
                        return res.status(400).json({
                            error: 'Bad Request',
                            message: 'start_date and end_date are required for custom period',
                        });
                    }
                    startDate = start_date as string;
                    endDate = end_date as string;
                    break;
                default:
                    return res.status(400).json({
                        error: 'Bad Request',
                        message: 'Invalid period. Use: daily, weekly, monthly, or custom',
                    });
            }

            // Validate dates
            if (!moment(startDate).isValid() || !moment(endDate).isValid()) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'Invalid date format. Use YYYY-MM-DD',
                });
            }

            if (moment(startDate).isAfter(moment(endDate))) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'start_date cannot be after end_date',
                });
            }

            // Parse account IDs (comma-separated)
            const accountIdList = accountIds.split(',').map(id => id.trim());
            if (accountIdList.length === 0) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'At least one account ID is required',
                });
            }

            // Get comprehensive data for all accounts
            const allComprehensiveData: any[] = [];

            for (const accountId of accountIdList) {
                try {
                    const comprehensiveData = await stripeService.getComprehensiveTransactions(
                        req.user!.secretKey,
                        accountId,
                        startDate,
                        endDate,
                        timezone as string
                    );

                    // Add account_id to all data
                    const dataWithAccountId = {
                        ...comprehensiveData,
                        account_id: accountId,
                    };

                    allComprehensiveData.push(dataWithAccountId);
                } catch (error) {
                    console.error(`Error processing account ${accountId}:`, error);
                    // Continue with other accounts
                }
            }

            if (format === 'csv') {
                // Generate comprehensive CSV
                const csvData = generateComprehensiveCsv(allComprehensiveData);
                const zipPassword = 'stripe2024!';
                const csvBuffer = Buffer.from(csvData, 'utf-8');
                const zipBuffer = await createPasswordProtectedZip(
                    csvBuffer,
                    `stripe-comprehensive-report-${startDate}-${endDate}.csv`,
                    zipPassword
                );

                res.setHeader('Content-Type', 'application/zip');
                res.setHeader(
                    'Content-Disposition',
                    `attachment; filename="stripe-comprehensive-report-${startDate}-${endDate}-PROTECTED.csv.zip"`
                );
                res.setHeader('Content-Length', zipBuffer.length.toString());
                return res.send(zipBuffer);
            } else {
                // Generate comprehensive Excel with multiple sheets
                const workbook = XLSX.utils.book_new();
                
                // Summary sheet
                const summaryData = generateSummarySheet(allComprehensiveData);
                const summarySheet = XLSX.utils.json_to_sheet(summaryData);
                XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

                // Payment Intents sheet
                const paymentIntentsData = generatePaymentIntentsSheet(allComprehensiveData);
                const paymentIntentsSheet = XLSX.utils.json_to_sheet(paymentIntentsData);
                XLSX.utils.book_append_sheet(workbook, paymentIntentsSheet, 'Payment Intents');

                // Balance Transactions sheet
                const balanceTransactionsData = generateBalanceTransactionsSheet(allComprehensiveData);
                const balanceTransactionsSheet = XLSX.utils.json_to_sheet(balanceTransactionsData);
                XLSX.utils.book_append_sheet(workbook, balanceTransactionsSheet, 'Balance Transactions');

                // Events sheet
                const eventsData = generateEventsSheet(allComprehensiveData);
                const eventsSheet = XLSX.utils.json_to_sheet(eventsData);
                XLSX.utils.book_append_sheet(workbook, eventsSheet, 'Events');

                // Detailed Refunds sheet
                const refundsData = generateRefundsSheet(allComprehensiveData);
                const refundsSheet = XLSX.utils.json_to_sheet(refundsData);
                XLSX.utils.book_append_sheet(workbook, refundsSheet, 'Refunds');

                // Detailed Disputes sheet
                const disputesData = generateDisputesSheet(allComprehensiveData);
                const disputesSheet = XLSX.utils.json_to_sheet(disputesData);
                XLSX.utils.book_append_sheet(workbook, disputesSheet, 'Disputes');

                const excelBuffer = XLSX.write(workbook, {
                    bookType: 'xlsx',
                    type: 'buffer',
                });

                const zipPassword = 'stripe2024!';
                const zipBuffer = await createPasswordProtectedZip(
                    excelBuffer,
                    `stripe-comprehensive-report-${startDate}-${endDate}.xlsx`,
                    zipPassword
                );

                res.setHeader('Content-Type', 'application/zip');
                res.setHeader(
                    'Content-Disposition',
                    `attachment; filename="stripe-comprehensive-report-${startDate}-${endDate}-PROTECTED.zip"`
                );
                res.setHeader('Content-Length', zipBuffer.length.toString());
                return res.send(zipBuffer);
            }
        } catch (error) {
            console.error('Error exporting comprehensive data:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to export comprehensive data',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
);

// Helper functions for comprehensive export
function generateComprehensiveCsv(data: any[]): string {
    const headers = [
        'Account ID',
        'Data Type',
        'ID',
        'Amount',
        'Currency',
        'Status',
        'Created',
        'Description',
        'Additional Info'
    ];

    const rows: any[] = [];

    data.forEach(accountData => {
        const accountId = accountData.account_id;

        // Add payment intents
        accountData.paymentIntents.forEach((pi: any) => {
            rows.push([
                accountId,
                'Payment Intent',
                pi.id,
                pi.amount / 100,
                pi.currency,
                pi.status,
                moment.unix(pi.created).format('YYYY-MM-DD HH:mm:ss'),
                pi.description || '',
                `Payment Method: ${pi.payment_method_types?.join(', ') || 'N/A'}`
            ]);
        });

        // Add balance transactions
        accountData.balanceTransactions.forEach((bt: any) => {
            rows.push([
                accountId,
                'Balance Transaction',
                bt.id,
                bt.amount / 100,
                bt.currency,
                bt.status,
                moment.unix(bt.created).format('YYYY-MM-DD HH:mm:ss'),
                bt.description || '',
                `Type: ${bt.type}, Net: ${bt.net / 100}`
            ]);
        });

        // Add events
        accountData.events.forEach((event: any) => {
            rows.push([
                accountId,
                'Event',
                event.id,
                0,
                'N/A',
                event.type,
                moment.unix(event.created).format('YYYY-MM-DD HH:mm:ss'),
                event.type,
                `Livemode: ${event.livemode}`
            ]);
        });

        // Add detailed refunds
        accountData.detailedRefunds.forEach((refund: any) => {
            rows.push([
                accountId,
                'Refund',
                refund.id,
                refund.amount / 100,
                refund.currency,
                refund.status,
                moment.unix(refund.created).format('YYYY-MM-DD HH:mm:ss'),
                refund.reason || '',
                `Charge: ${refund.charge}`
            ]);
        });

        // Add detailed disputes
        accountData.detailedDisputes.forEach((dispute: any) => {
            rows.push([
                accountId,
                'Dispute',
                dispute.id,
                dispute.amount / 100,
                dispute.currency,
                dispute.status,
                moment.unix(dispute.created).format('YYYY-MM-DD HH:mm:ss'),
                dispute.reason || '',
                `Charge: ${dispute.charge}`
            ]);
        });
    });

    return [headers, ...rows]
        .map(row => row.map((cell: any) => `"${cell}"`).join(','))
        .join('\n');
}

function generateSummarySheet(data: any[]): any[] {
    const summaryData: any[] = [];

    data.forEach(accountData => {
        const accountId = accountData.account_id;
        
        summaryData.push({
            'Account ID': accountId,
            'Payment Intents Count': accountData.paymentIntents.length,
            'Balance Transactions Count': accountData.balanceTransactions.length,
            'Events Count': accountData.events.length,
            'Refunds Count': accountData.detailedRefunds.length,
            'Disputes Count': accountData.detailedDisputes.length,
            'Total Payment Intents Amount': accountData.paymentIntents.reduce((sum: number, pi: any) => sum + (pi.amount || 0), 0) / 100,
            'Total Refunds Amount': accountData.detailedRefunds.reduce((sum: number, refund: any) => sum + (refund.amount || 0), 0) / 100,
            'Total Disputes Amount': accountData.detailedDisputes.reduce((sum: number, dispute: any) => sum + (dispute.amount || 0), 0) / 100,
        });
    });

    return summaryData;
}

function generatePaymentIntentsSheet(data: any[]): any[] {
    const paymentIntentsData: any[] = [];

    data.forEach(accountData => {
        accountData.paymentIntents.forEach((pi: any) => {
            paymentIntentsData.push({
                'Account ID': accountData.account_id,
                'Payment Intent ID': pi.id,
                'Amount': pi.amount / 100,
                'Currency': pi.currency,
                'Status': pi.status,
                'Created': moment.unix(pi.created).format('YYYY-MM-DD HH:mm:ss'),
                'Description': pi.description || '',
                'Payment Method Types': pi.payment_method_types?.join(', ') || 'N/A',
                'Client Secret': pi.client_secret || '',
                'Confirmation Method': pi.confirmation_method || '',
                'Receipt Email': pi.receipt_email || '',
            });
        });
    });

    return paymentIntentsData;
}

function generateBalanceTransactionsSheet(data: any[]): any[] {
    const balanceTransactionsData: any[] = [];

    data.forEach(accountData => {
        accountData.balanceTransactions.forEach((bt: any) => {
            balanceTransactionsData.push({
                'Account ID': accountData.account_id,
                'Transaction ID': bt.id,
                'Amount': bt.amount / 100,
                'Currency': bt.currency,
                'Status': bt.status,
                'Created': moment.unix(bt.created).format('YYYY-MM-DD HH:mm:ss'),
                'Description': bt.description || '',
                'Type': bt.type,
                'Net': bt.net / 100,
                'Fee': bt.fee / 100,
                'Fee Details': JSON.stringify(bt.fee_details || []),
            });
        });
    });

    return balanceTransactionsData;
}

function generateEventsSheet(data: any[]): any[] {
    const eventsData: any[] = [];

    data.forEach(accountData => {
        accountData.events.forEach((event: any) => {
            eventsData.push({
                'Account ID': accountData.account_id,
                'Event ID': event.id,
                'Type': event.type,
                'Created': moment.unix(event.created).format('YYYY-MM-DD HH:mm:ss'),
                'Livemode': event.livemode,
                'Pending Webhooks': event.pending_webhooks,
                'Request ID': event.request?.id || '',
                'API Version': event.api_version || '',
            });
        });
    });

    return eventsData;
}

function generateRefundsSheet(data: any[]): any[] {
    const refundsData: any[] = [];

    data.forEach(accountData => {
        accountData.detailedRefunds.forEach((refund: any) => {
            refundsData.push({
                'Account ID': accountData.account_id,
                'Refund ID': refund.id,
                'Amount': refund.amount / 100,
                'Currency': refund.currency,
                'Status': refund.status,
                'Created': moment.unix(refund.created).format('YYYY-MM-DD HH:mm:ss'),
                'Reason': refund.reason || '',
                'Charge ID': refund.charge,
                'Receipt Number': refund.receipt_number || '',
                'Payment Intent ID': refund.payment_intent || '',
            });
        });
    });

    return refundsData;
}

function generateDisputesSheet(data: any[]): any[] {
    const disputesData: any[] = [];

    data.forEach(accountData => {
        accountData.detailedDisputes.forEach((dispute: any) => {
            disputesData.push({
                'Account ID': accountData.account_id,
                'Dispute ID': dispute.id,
                'Amount': dispute.amount / 100,
                'Currency': dispute.currency,
                'Status': dispute.status,
                'Created': moment.unix(dispute.created).format('YYYY-MM-DD HH:mm:ss'),
                'Reason': dispute.reason || '',
                'Charge ID': dispute.charge,
                'Evidence Due By': dispute.evidence_details?.due_by ? moment.unix(dispute.evidence_details.due_by).format('YYYY-MM-DD HH:mm:ss') : '',
                'Evidence Submission Count': dispute.evidence_details?.submission_count || 0,
            });
        });
    });

    return disputesData;
}

// Compliance Export endpoint with fraud monitoring details
router.post(
    '/compliance/:accountIds',
    validateJWT,
    validateStripeKeys,
    async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
        try {
            const { accountIds } = req.params;
            const { start_date, end_date, timezone = 'UTC', period = 'custom', format = 'xlsx' } = req.body;

            let startDate: string, endDate: string;

            // Handle different period types
            switch (period) {
                case 'daily':
                    startDate = moment().subtract(1, 'day').format('YYYY-MM-DD');
                    endDate = moment().format('YYYY-MM-DD');
                    break;
                case 'weekly':
                    startDate = moment().subtract(7, 'days').format('YYYY-MM-DD');
                    endDate = moment().format('YYYY-MM-DD');
                    break;
                case 'monthly':
                    startDate = moment().subtract(30, 'days').format('YYYY-MM-DD');
                    endDate = moment().format('YYYY-MM-DD');
                    break;
                case 'custom':
                    if (!start_date || !end_date) {
                        return res.status(400).json({
                            error: 'Bad Request',
                            message: 'start_date and end_date are required for custom period',
                        });
                    }
                    startDate = start_date as string;
                    endDate = end_date as string;
                    break;
                default:
                    return res.status(400).json({
                        error: 'Bad Request',
                        message: 'Invalid period. Use: daily, weekly, monthly, or custom',
                    });
            }

            // Validate dates
            if (!moment(startDate).isValid() || !moment(endDate).isValid()) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'Invalid date format. Use YYYY-MM-DD',
                });
            }

            if (moment(startDate).isAfter(moment(endDate))) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'start_date cannot be after end_date',
                });
            }

            // Parse account IDs (comma-separated)
            const accountIdList = accountIds.split(',').map(id => id.trim());
            if (accountIdList.length === 0) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'At least one account ID is required',
                });
            }

            // Get compliance data for all accounts
            const allComplianceData: any[] = [];

            for (const accountId of accountIdList) {
                try {
                    const complianceData = await stripeService.getComplianceTransactions(
                        req.user!.secretKey,
                        accountId,
                        startDate,
                        endDate,
                        timezone as string
                    );

                    // Add account_id to all data
                    const dataWithAccountId = {
                        ...complianceData,
                        account_id: accountId,
                    };

                    allComplianceData.push(dataWithAccountId);
                } catch (error) {
                    console.error(`Error processing account ${accountId}:`, error);
                    // Continue with other accounts
                }
            }

            if (format === 'csv') {
                // Generate compliance CSV
                const csvData = generateComplianceCsv(allComplianceData);
                const zipPassword = 'stripe2024!';
                const csvBuffer = Buffer.from(csvData, 'utf-8');
                const zipBuffer = await createPasswordProtectedZip(
                    csvBuffer,
                    `stripe-compliance-report-${startDate}-${endDate}.csv`,
                    zipPassword
                );

                res.setHeader('Content-Type', 'application/zip');
                res.setHeader(
                    'Content-Disposition',
                    `attachment; filename="stripe-compliance-report-${startDate}-${endDate}-PROTECTED.csv.zip"`
                );
                res.setHeader('Content-Length', zipBuffer.length.toString());
                return res.send(zipBuffer);
            } else {
                // Generate compliance Excel with multiple sheets
                const workbook = XLSX.utils.book_new();
                
                // Charges with compliance details sheet
                const chargesData = generateComplianceChargesSheet(allComplianceData);
                const chargesSheet = XLSX.utils.json_to_sheet(chargesData);
                XLSX.utils.book_append_sheet(workbook, chargesSheet, 'Charges Compliance');

                // Payment Intents with fraud details sheet
                const paymentIntentsData = generateCompliancePaymentIntentsSheet(allComplianceData);
                const paymentIntentsSheet = XLSX.utils.json_to_sheet(paymentIntentsData);
                XLSX.utils.book_append_sheet(workbook, paymentIntentsSheet, 'Payment Intents');

                // Balance Transactions sheet
                const balanceTransactionsData = generateComplianceBalanceTransactionsSheet(allComplianceData);
                const balanceTransactionsSheet = XLSX.utils.json_to_sheet(balanceTransactionsData);
                XLSX.utils.book_append_sheet(workbook, balanceTransactionsSheet, 'Balance Transactions');

                // Events sheet
                const eventsData = generateComplianceEventsSheet(allComplianceData);
                const eventsSheet = XLSX.utils.json_to_sheet(eventsData);
                XLSX.utils.book_append_sheet(workbook, eventsSheet, 'Events');

                // Refunds sheet
                const refundsData = generateComplianceRefundsSheet(allComplianceData);
                const refundsSheet = XLSX.utils.json_to_sheet(refundsData);
                XLSX.utils.book_append_sheet(workbook, refundsSheet, 'Refunds');

                // Disputes sheet
                const disputesData = generateComplianceDisputesSheet(allComplianceData);
                const disputesSheet = XLSX.utils.json_to_sheet(disputesData);
                XLSX.utils.book_append_sheet(workbook, disputesSheet, 'Disputes');

                const excelBuffer = XLSX.write(workbook, {
                    bookType: 'xlsx',
                    type: 'buffer',
                });

                const zipPassword = 'stripe2024!';
                const zipBuffer = await createPasswordProtectedZip(
                    excelBuffer,
                    `stripe-compliance-report-${startDate}-${endDate}.xlsx`,
                    zipPassword
                );

                res.setHeader('Content-Type', 'application/zip');
                res.setHeader(
                    'Content-Disposition',
                    `attachment; filename="stripe-compliance-report-${startDate}-${endDate}-PROTECTED.zip"`
                );
                res.setHeader('Content-Length', zipBuffer.length.toString());
                return res.send(zipBuffer);
            }
        } catch (error) {
            console.error('Error exporting compliance data:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to export compliance data',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
);

// Helper functions for compliance export
function generateComplianceCsv(data: any[]): string {
    const headers = [
        'Account ID',
        'Data Type',
        'ID',
        'Amount',
        'Currency',
        'Status',
        'Created',
        'Failure Code',
        'Failure Message',
        'Network Status',
        'Outcome Type',
        'Risk Level',
        'Outcome Reason',
        'Seller Message',
        'Description'
    ];

    const rows: any[] = [];

    data.forEach(accountData => {
        const accountId = accountData.account_id;

        // Add charges with compliance details
        accountData.charges.forEach((charge: any) => {
            rows.push([
                accountId,
                'Charge',
                charge.id,
                charge.amount / 100,
                charge.currency,
                charge.status,
                moment.unix(charge.created).format('YYYY-MM-DD HH:mm:ss'),
                charge.failure_code || '',
                charge.failure_message || '',
                charge.outcome?.network_status || '',
                charge.outcome?.type || '',
                charge.outcome?.risk_level || '',
                charge.outcome?.reason || '',
                charge.outcome?.seller_message || '',
                charge.description || ''
            ]);
        });

        // Add payment intents
        accountData.paymentIntents.forEach((pi: any) => {
            rows.push([
                accountId,
                'Payment Intent',
                pi.id,
                pi.amount / 100,
                pi.currency,
                pi.status,
                moment.unix(pi.created).format('YYYY-MM-DD HH:mm:ss'),
                pi.last_payment_error?.code || '',
                pi.last_payment_error?.message || '',
                '', // Network status not available in PI
                pi.last_payment_error?.type || '',
                '', // Risk level not available in PI
                pi.last_payment_error?.decline_code || '',
                pi.last_payment_error?.message || '',
                pi.description || ''
            ]);
        });
    });

    return [headers, ...rows]
        .map(row => row.map((cell: any) => `"${cell}"`).join(','))
        .join('\n');
}

function generateComplianceChargesSheet(data: any[]): any[] {
    const chargesData: any[] = [];

    data.forEach(accountData => {
        accountData.charges.forEach((charge: any) => {
            chargesData.push({
                'Account ID': accountData.account_id,
                'Charge ID': charge.id,
                'Amount': charge.amount / 100,
                'Currency': charge.currency,
                'Status': charge.status,
                'Created': moment.unix(charge.created).format('YYYY-MM-DD HH:mm:ss'),
                'Paid': charge.paid,
                'Captured': charge.captured,
                'Disputed': charge.disputed,
                'Failure Code': charge.failure_code || '',
                'Failure Message': charge.failure_message || '',
                'Network Status': charge.outcome?.network_status || '',
                'Outcome Type': charge.outcome?.type || '',
                'Risk Level': charge.outcome?.risk_level || '',
                'Outcome Reason': charge.outcome?.reason || '',
                'Seller Message': charge.outcome?.seller_message || '',
                'Description': charge.description || '',
                'Customer ID': charge.customer || '',
                'Payment Method ID': charge.payment_method || '',
                'Receipt Email': charge.receipt_email || '',
                'Statement Descriptor': charge.statement_descriptor || '',
                'Authorization Code': charge.authorization_code || '',
                'Balance Transaction ID': charge.balance_transaction || '',
                'Fraud Details': JSON.stringify(charge.fraud_details || {}),
                'Metadata': JSON.stringify(charge.metadata || {})
            });
        });
    });

    return chargesData;
}

function generateCompliancePaymentIntentsSheet(data: any[]): any[] {
    const paymentIntentsData: any[] = [];

    data.forEach(accountData => {
        accountData.paymentIntents.forEach((pi: any) => {
            paymentIntentsData.push({
                'Account ID': accountData.account_id,
                'Payment Intent ID': pi.id,
                'Amount': pi.amount / 100,
                'Currency': pi.currency,
                'Status': pi.status,
                'Created': moment.unix(pi.created).format('YYYY-MM-DD HH:mm:ss'),
                'Description': pi.description || '',
                'Customer ID': pi.customer || '',
                'Payment Method Types': pi.payment_method_types?.join(', ') || 'N/A',
                'Last Payment Error Code': pi.last_payment_error?.code || '',
                'Last Payment Error Message': pi.last_payment_error?.message || '',
                'Last Payment Error Type': pi.last_payment_error?.type || '',
                'Last Payment Error Decline Code': pi.last_payment_error?.decline_code || '',
                'Receipt Email': pi.receipt_email || '',
                'Statement Descriptor': pi.statement_descriptor || '',
                'Confirmation Method': pi.confirmation_method || '',
                'Capture Method': pi.capture_method || '',
                'Cancellation Reason': pi.cancellation_reason || '',
                'Client Secret': pi.client_secret || '',
                'Metadata': JSON.stringify(pi.metadata || {})
            });
        });
    });

    return paymentIntentsData;
}

function generateComplianceBalanceTransactionsSheet(data: any[]): any[] {
    const balanceTransactionsData: any[] = [];

    data.forEach(accountData => {
        accountData.balanceTransactions.forEach((bt: any) => {
            balanceTransactionsData.push({
                'Account ID': accountData.account_id,
                'Transaction ID': bt.id,
                'Amount': bt.amount / 100,
                'Currency': bt.currency,
                'Status': bt.status,
                'Created': moment.unix(bt.created).format('YYYY-MM-DD HH:mm:ss'),
                'Description': bt.description || '',
                'Type': bt.type,
                'Net': bt.net / 100,
                'Fee': bt.fee / 100,
                'Fee Details': JSON.stringify(bt.fee_details || []),
                'Available On': bt.available_on ? moment.unix(bt.available_on).format('YYYY-MM-DD HH:mm:ss') : '',
                'Source ID': bt.source || '',
                'Source Type': bt.source_type || ''
            });
        });
    });

    return balanceTransactionsData;
}

function generateComplianceEventsSheet(data: any[]): any[] {
    const eventsData: any[] = [];

    data.forEach(accountData => {
        accountData.events.forEach((event: any) => {
            eventsData.push({
                'Account ID': accountData.account_id,
                'Event ID': event.id,
                'Type': event.type,
                'Created': moment.unix(event.created).format('YYYY-MM-DD HH:mm:ss'),
                'Livemode': event.livemode,
                'Pending Webhooks': event.pending_webhooks,
                'Request ID': event.request?.id || '',
                'API Version': event.api_version || '',
                'Data Object Type': event.data?.object?.object || '',
                'Data Object ID': event.data?.object?.id || ''
            });
        });
    });

    return eventsData;
}

function generateComplianceRefundsSheet(data: any[]): any[] {
    const refundsData: any[] = [];

    data.forEach(accountData => {
        accountData.refunds.forEach((refund: any) => {
            refundsData.push({
                'Account ID': accountData.account_id,
                'Refund ID': refund.id,
                'Amount': refund.amount / 100,
                'Currency': refund.currency,
                'Status': refund.status,
                'Created': moment.unix(refund.created).format('YYYY-MM-DD HH:mm:ss'),
                'Reason': refund.reason || '',
                'Charge ID': refund.charge,
                'Receipt Number': refund.receipt_number || '',
                'Payment Intent ID': refund.payment_intent || '',
                'Description': refund.description || '',
                'Metadata': JSON.stringify(refund.metadata || {})
            });
        });
    });

    return refundsData;
}

function generateComplianceDisputesSheet(data: any[]): any[] {
    const disputesData: any[] = [];

    data.forEach(accountData => {
        accountData.disputes.forEach((dispute: any) => {
            disputesData.push({
                'Account ID': accountData.account_id,
                'Dispute ID': dispute.id,
                'Amount': dispute.amount / 100,
                'Currency': dispute.currency,
                'Status': dispute.status,
                'Created': moment.unix(dispute.created).format('YYYY-MM-DD HH:mm:ss'),
                'Reason': dispute.reason || '',
                'Charge ID': dispute.charge,
                'Evidence Due By': dispute.evidence_details?.due_by ? moment.unix(dispute.evidence_details.due_by).format('YYYY-MM-DD HH:mm:ss') : '',
                'Evidence Submission Count': dispute.evidence_details?.submission_count || 0,
                'Evidence Past Due': dispute.evidence_details?.past_due || false,
                'Evidence Has Evidence': dispute.evidence_details?.has_evidence || false,
                'Dispute Type': dispute.dispute_type || '',
                'Livemode': dispute.livemode,
                'Metadata': JSON.stringify(dispute.metadata || {})
            });
        });
    });

    return disputesData;
}

// Test endpoint to demonstrate comprehensive data fetching
router.post(
    '/test-comprehensive/:accountIds',
    validateJWT,
    validateStripeKeys,
    async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
        try {
            const { accountIds } = req.params;
            const { start_date, end_date, timezone = 'UTC' } = req.body;

            if (!start_date || !end_date) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'start_date and end_date are required',
                });
            }

            // Parse account IDs (comma-separated)
            const accountIdList = accountIds.split(',').map(id => id.trim());
            if (accountIdList.length === 0) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'At least one account ID is required',
                });
            }

            // Test comprehensive data fetching for the first account
            const testAccountId = accountIdList[0];
            const comprehensiveData = await stripeService.getComprehensiveTransactions(
                req.user!.secretKey,
                testAccountId,
                start_date,
                end_date,
                timezone as string
            );

            // Return summary of what was fetched
            return res.json({
                success: true,
                message: 'Comprehensive data fetch test successful',
                data: {
                    accountId: testAccountId,
                    dateRange: { start_date, end_date },
                    summary: {
                        transactions: comprehensiveData.transactions.length,
                        paymentIntents: comprehensiveData.paymentIntents.length,
                        balanceTransactions: comprehensiveData.balanceTransactions.length,
                        events: comprehensiveData.events.length,
                        detailedRefunds: comprehensiveData.detailedRefunds.length,
                        detailedDisputes: comprehensiveData.detailedDisputes.length,
                    },
                    sampleData: {
                        firstPaymentIntent: comprehensiveData.paymentIntents[0] ? {
                            id: comprehensiveData.paymentIntents[0].id,
                            amount: comprehensiveData.paymentIntents[0].amount / 100,
                            status: comprehensiveData.paymentIntents[0].status,
                            created: moment.unix(comprehensiveData.paymentIntents[0].created).format('YYYY-MM-DD HH:mm:ss')
                        } : null,
                        firstBalanceTransaction: comprehensiveData.balanceTransactions[0] ? {
                            id: comprehensiveData.balanceTransactions[0].id,
                            amount: comprehensiveData.balanceTransactions[0].amount / 100,
                            type: comprehensiveData.balanceTransactions[0].type,
                            created: moment.unix(comprehensiveData.balanceTransactions[0].created).format('YYYY-MM-DD HH:mm:ss')
                        } : null,
                        firstEvent: comprehensiveData.events[0] ? {
                            id: comprehensiveData.events[0].id,
                            type: comprehensiveData.events[0].type,
                            created: moment.unix(comprehensiveData.events[0].created).format('YYYY-MM-DD HH:mm:ss')
                        } : null,
                    }
                }
            });
        } catch (error) {
            console.error('Error testing comprehensive data:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to test comprehensive data',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
);

async function testConnection() {
    try {
        const result = await pool.query('SELECT NOW()');
        console.log('Connected to PostgreSQL! Current time:', result.rows[0].now);
    } catch (err) {
        console.error('Database connection error:', err);
    } finally {
        // await pool.end(); // close the pool when done
    }
}

testConnection();

export default router;
