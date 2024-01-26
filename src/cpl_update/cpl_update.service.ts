import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import * as mysql from 'mysql2/promise';
import { ConfigService } from '@nestjs/config';
import { error } from 'console';

@Injectable()
export class CplUpdateService {
  private connection: mysql.Pool;
  constructor(private readonly configservice: ConfigService) {
    this.connection = mysql.createPool({
      host: this.configservice.get<string>('DB_HOST'),
      user: this.configservice.get<string>('DB_USERNAME'),
      password: this.configservice.get<string>('DB_PASSWORD'),
    });
  }
  async getCplUpdate(filePath: string): Promise<any> {
    const query: string[] = [];
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // Assuming the data is in the first sheet
    const worksheet = workbook.Sheets[sheetName];

    let parsedDataArray: any[] = [];

    XLSX.utils
      .sheet_to_json(worksheet, {
        header: [
          'Item',
          'Lot in Legacy',
          'Lot in RAPID',
          'Shade',
          'Roll No',
          'C-TEX Length',
          'C-TEX Width',
        ],
        defval: '',
      })
      .forEach((row: any) => {
        parsedDataArray.push(row);
      });

    parsedDataArray = parsedDataArray.slice(1);

    let lotNumbers: string[] = [];
    let lotRollCombo: any[] = [];

    for (let data of parsedDataArray) {
      lotNumbers.push(data['Lot in RAPID']);
      lotRollCombo.push({
        lot_no: data['Lot in RAPID'],
        display_id: data['Roll No'],
      });
    }

    var inventoryData: any;
    try {
      const inventoryDataquery = `SELECT lot_no, inventory_id, display_id FROM wms.store_in si WHERE lot_no in ?`;
      inventoryData = await this.connection.query(inventoryDataquery, [
        [lotNumbers],
      ]);
      console.log('Inventory data retrieved from database.');
      let filteredInventoryData = inventoryData[0].filter((secondObj) => {
        return lotRollCombo.some((firstObj) => {
          return (
            firstObj.lot_no == secondObj.lot_no &&
            firstObj.display_id == secondObj.display_id
          );
        });
      });

      console.log('Inventory data filtered using Excel data.');

      for (let i = 0; i < parsedDataArray.length; i++) {
        const row = parsedDataArray[i];
        const lotNumber = row['Lot in RAPID'];
        const rollNumber = row['Roll No'];

        const shade = row['Shade'];
        const length = row['C-TEX Length'];
        const width = row['C-TEX Width'];

        try {
          const inventoryIdData = filteredInventoryData.filter((invData) => {
            return (
              invData.lot_no == lotNumber && invData.display_id == rollNumber
            );
          });
          query.push(
            `UPDATE wms.reported_inspection_details SET actual_width = ${width}, actual_length = ${length}, shade = '${shade}' WHERE inventory_id = '${inventoryIdData[0].inventory_id}';`,
          );
          //return `UPDATE wms.reported_inspection_details SET actual_width = ${width}, actual_length = ${length}, shade = '${shade}' WHERE inventory_id = '${inventoryIdData[0].inventory_id}';`;
        } catch (e) {
          return `Inventory ID missing: ${lotNumber} - ${rollNumber}`;
        }
      }
    } catch (error) {
      return { error };
    }
    return query;
  }
}
