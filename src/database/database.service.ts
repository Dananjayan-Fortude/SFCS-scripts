import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mysql from 'mysql2/promise';
import * as path from 'path';
import * as ExcelJS from 'exceljs';
import { Response } from 'express';
import { RowDataPacket } from 'mysql2/promise';

export interface ErrorPayloadResponse {
  errors: string[];
  payloads: JSON[];
  headerID: number;
  suspenededStep: number;
  picklistStatus: number;
  allocatedStatus: number;
  error_codes: string[];
}

export interface queryResponse {
  details: string;
  picklistUpdate: string;
  suspenededUpdate: string;
}

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

      if (!picklistHeaderResults[0]) {
        res.status(404).json({ error: 'No data found' });
        return;
      }

      const picklistHeaderId = picklistHeaderResults.map(
        (item) => item[0].picklist_header_id,
      );

      console.log(picklistHeaderId[0]);

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

  // async getErrorPayload(displayId: string, res: Response) {
  //   console.log('displayId', displayId);
  //   try {
  //     const picklistHeaderQuery = `
  //       SELECT *
  //       FROM wms.warehouse_request_picklist_header
  //       WHERE picklist_header_display_id = ?`;

  //     const picklistHeaderResults = await this.connection.query(
  //       picklistHeaderQuery,
  //       [displayId],
  //     );

  //     if (!picklistHeaderResults[0]) {
  //       res.status(404).json({ error: 'No data found' });
  //       return;
  //     }

  //     const picklistHeaderId = picklistHeaderResults.map(
  //       (item) => item[0].picklist_header_id,
  //     );

  //     const errorPayloadQuery = ` select *
  //     from wms.warehouse_request_picklist_allocation_status
  //     WHERE picklist_header_id = ?
  //       and is_active = true
  //       and warehouse_request_picklist_allocation_status.error_msg IS NOT NULL;`;

  //     const errorPayloadResults = await this.connection.query(
  //       errorPayloadQuery,
  //       [picklistHeaderId[0]],
  //     );

  //     if (!errorPayloadResults[0]) {
  //       res.status(404).json({ error: 'No data found' });
  //       return;
  //     }

  //     const payloads: JSON[] = [];
  //     if (
  //       Array.isArray(errorPayloadResults[0]) &&
  //       errorPayloadResults[0].length > 1
  //     ) {
  //       for (let i = 0; i < errorPayloadResults[0].length; i++) {
  //         const result = errorPayloadResults[0][i];

  //         // Check if result is of type RowDataPacket
  //         if ('payload' in result) {
  //           const payload = result.payload;
  //           const parsedPayload = JSON.parse(payload);
  //           payloads.push(parsedPayload);
  //         } else {
  //           // Handle other types (OkPacket, ResultSetHeader, etc.) if needed
  //           console.log('Unhandled result type:', result);
  //         }
  //       }

  //       res.status(200).json(payloads);
  //     } else {
  //       const payload = errorPayloadResults.map((item) => item[0].payload);
  //       const parsedPayload = JSON.parse(payload[0]);
  //       res.status(200).end(parsedPayload);
  //     }
  //   } catch (error) {
  //     console.error('Error in getData:', error);
  //     res.status(500).json({ error: 'Internal Server Error' });
  //   }
  // }
  async getErrorPayload(displayId: string): Promise<ErrorPayloadResponse> {
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

      if (
        Array.isArray(picklistHeaderResults[0]) &&
        picklistHeaderResults[0].length > 1
      ) {
        return Promise.reject({ error: 'No data found' });
      }
      let picklistHeaderId: any;
      let suspenededStep: any;
      let picklistStatus: any;
      let allocatedStatus: any;
      try {
        picklistHeaderId = picklistHeaderResults.map(
          (item) => item[0].picklist_header_id,
        );
        suspenededStep = picklistHeaderResults.map(
          (item) => item[0].suspended_step,
        );
        picklistStatus = picklistHeaderResults.map(
          (item) => item[0].picklist_status,
        );
        allocatedStatus = picklistHeaderResults.map(
          (item) => item[0].is_alloc_completed,
        );
      } catch (error) {
        console.log('No data found');
        return Promise.reject({ error: 'No data found' });
      }

      const errorPayloadQuery = ` select *
      from wms.warehouse_request_picklist_allocation_status
      WHERE picklist_header_id = ?
        and is_active = true
        and warehouse_request_picklist_allocation_status.error_msg IS NOT NULL;`;

      const errorPayloadResults = await this.connection.query(
        errorPayloadQuery,
        [picklistHeaderId[0]],
      );

      // if (
      //   Array.isArray(errorPayloadResults[0]) &&
      //   errorPayloadResults[0].length > 1
      // ) {
      //   console.log('No data found');
      //   return Promise.reject({ error: 'No data found' });
      // }

      const payloads: JSON[] = [];
      const errors: string[] = [];
      const error_codes: string[] = [];
      if (
        Array.isArray(errorPayloadResults[0]) &&
        errorPayloadResults[0].length > 1
      ) {
        for (let i = 0; i < errorPayloadResults[0].length; i++) {
          const result = errorPayloadResults[0][i];

          // Check if result is of type RowDataPacket
          if ('payload' in result) {
            const payload = result.payload;
            console.log(result.error_code);
            // console.log(result.error_msg);
            errors.push(result.error_msg);
            error_codes.push(result.error_code);
            const parsedPayload = JSON.parse(payload);
            payloads.push(parsedPayload);
          } else {
            // Handle other types (OkPacket, ResultSetHeader, etc.) if needed
            console.log('Unhandled result type:', result);
          }
        }

        return {
          errors,
          payloads,
          headerID: picklistHeaderId[0],
          suspenededStep: suspenededStep[0],
          picklistStatus: picklistStatus[0],
          allocatedStatus: allocatedStatus[0],
          error_codes,
        };
      }
      if ((errorPayloadResults[0] as RowDataPacket[]).length === 0) {
        console.log('No data found');
        const error = 'No data found';
        errors.push(error);
        return {
          errors,
          payloads,
          headerID: picklistHeaderId[0],
          suspenededStep: suspenededStep[0],
          picklistStatus: picklistStatus[0],
          allocatedStatus: allocatedStatus[0],
          error_codes,
        };
        //return Promise.reject({ error: 'No data found' });
      } else {
        console.log(errorPayloadResults[0]);
        const payloads: JSON[] = [];
        const errors: string[] = [];
        const error_codes: string[] = [];
        const payload = errorPayloadResults.map((item) => item[0].payload);
        console.log(payload[0]);
        payloads.push(JSON.parse(payload[0].toString()));
        const error = errorPayloadResults.map((item) => item[0].error_msg);
        const error_code = errorPayloadResults.map(
          (item) => item[0].error_code,
        );
        error_codes.push(error_code.toString());
        errors.push(error.toString());
        return {
          errors,
          payloads,
          headerID: picklistHeaderId[0],
          suspenededStep: suspenededStep[0],
          picklistStatus: picklistStatus[0],
          allocatedStatus: allocatedStatus[0],
          error_codes,
        };
      }
    } catch (error) {
      console.error('Error in getData:', error);
      return Promise.reject({ error: 'Internal Server Error' });
    }
  }
  async getQuery(displayId: string): Promise<queryResponse> {
    try {
      const picklistHeaderQuery = `SELECT picklist_header_id
      from wms.warehouse_request_picklist_header
      WHERE picklist_header_display_id = ?;`;
      const picklistHeaderResults = await this.connection.query(
        picklistHeaderQuery,
        [displayId],
      );

      if ((picklistHeaderResults[0] as RowDataPacket[]).length === 0) {
        console.log('No data found');
        return Promise.reject({ error: 'No data found' });
      } else {
        const picklistHeaderId = picklistHeaderResults.map(
          (item) => item[0].picklist_header_id,
        );
        const query = `select request_header_id
        from wms.warehouse_request_picklist_header
        WHERE picklist_header_id = ?;`;
        const results = await this.connection.query(query, [
          picklistHeaderId[0],
        ]);
        const request_header_id = results.map(
          (item) => item[0].request_header_id,
        );
        // return request_header_id[0];
        const picklistUpdate = `UPDATE wms.warehouse_request_picklist_header
        SET picklist_status=2
        WHERE picklist_header_id= '${picklistHeaderId[0]}' ;`;
        const suspenededUpdate = `UPDATE wms.warehouse_request_header
        SET is_suspended=0
        WHERE request_header_id= '${request_header_id[0]}' ;`;
        let details = `- Picklist Header ID: ${picklistHeaderId[0]}\n- Display ID: ${displayId}\n- Request Header ID: ${request_header_id[0]}`;
        return { details, picklistUpdate, suspenededUpdate };
      }
    } catch (error) {
      console.error('Error in getData:', error);
      return Promise.reject({ error });
    }
  }
}
