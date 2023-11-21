import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mysql from 'mysql2/promise';
import * as path from 'path';
import * as ExcelJS from 'exceljs';
import { Response } from 'express';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private connection: mysql.Pool;

  constructor(private readonly configservice: ConfigService) {
    this.connection = mysql.createPool({
      host: this.configservice.get<string>('DB_HOST'),
      user: this.configservice.get<string>('DB_USERNAME'),
      password: this.configservice.get<string>('DB_PASSWORD'),
    });
  }

  async onModuleInit() {
    try {
      const connection = await this.connection.getConnection();
      console.log('Connected to MariaDB/MySQL');
      connection.release();
    } catch (error) {
      console.error(`Error connecting to MariaDB/MySQL: ${error.message}`);
    }
  }

  async test() {
    try {
      console.log(this.configservice.get<string>('DB_HOST'));
      console.log(this.configservice.get<string>('DB_USERNAME'));
      console.log(this.configservice.get<string>('DB_PASSWORD'));
      const connection = await this.connection.getConnection();
      connection.release();
      return 'Connected to MariaDB/MySQL';
    } catch (error) {
      return `Error connecting to MariaDB/MySQL: ${error}`;
    }
  }

  async getData(displayId: string, res: Response) {
    console.log('displayId', displayId);
    try {
      const picklistHeaderQuery = `
        SELECT *
        FROM wms.warehouse_request_picklist_header
        WHERE picklist_header_display_id = ?`;

      const picklistHeaderResults = await this.connection.query(
        picklistHeaderQuery,
        [displayId],
      );

      const picklistHeaderId = picklistHeaderResults.map(
        (item) => item[0].picklist_header_id,
      );

      const transactionSummaryQuery = `
        SELECT *
        FROM wms.transaction_summary
        WHERE ref_id = ?
        and transaction_summary_type = 'M3';`;

      const transactionSummaryResults = await this.connection.query(
        transactionSummaryQuery,
        [picklistHeaderId[0]],
      );

      if (!transactionSummaryResults[0]) {
        res.status(404).json({ error: 'No data found' });
        return;
      }

      const headers = Object.keys(transactionSummaryResults[0][0]);
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Transaction Summary');
      worksheet.addRow(headers);
      (transactionSummaryResults[0] as any[]).forEach((item) => {
        worksheet.addRow(Object.values(item));
      });

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      const fileName = `transaction_summary_${displayId}_${picklistHeaderId[0]}.xlsx`;
      const filePath = path.join(__dirname, '..', '..', '..', '..', fileName);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=${fileName}.xlsx`,
      );
      await workbook.xlsx.write(res);
      await workbook.xlsx.writeFile(filePath);
      console.log('Excel file saved to:', filePath);
      res.end('Excel file sent');
    } catch (error) {
      console.error('Error in getData:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}
