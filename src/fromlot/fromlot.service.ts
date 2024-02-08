import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mysql from 'mysql2/promise';
import * as https from 'https';
import axios from 'axios';
import { In } from 'typeorm';

interface From {
  lot: string;
  schedule: string;
}

interface Mo {
  moNumber: number;
  vpo: null | string;
  quantity: number;
  schedule: string;
}

interface To {
  mos: {
    moNumber: number;
    vpo: null | string;
    quantity: number;
    schedule: string;
  }[];
}

interface PayloadData {
  itemCode: string;
  from: From;
  to: To;
}

@Injectable()
export class FromlotService {
  //connection to the database
  private connection: mysql.Pool;

  constructor(private readonly configservice: ConfigService) {
    this.connection = mysql.createPool({
      host: this.configservice.get<string>('DB_HOST'),
      user: this.configservice.get<string>('DB_USERNAME'),
      password: this.configservice.get<string>('DB_PASSWORD'),
    });
  }

  async postError1(displayId: string) {
    const updateUser = 'vijendranD';
    console.log('displayId', displayId);
    try {
      const activeCheckQuery = `select * from wms.warehouse_request_picklist_header where picklist_header_display_id = ? and is_active = 1;`;
      const activeCheckResults = await this.connection.query(activeCheckQuery, [
        displayId,
      ]);
      if (!activeCheckResults[0]) {
        return {
          error: null,
          data: 'picklist is not active.',
        };
      }

      //getting the style from the display id
      const styleQuery = `select line.style,line.request_header_id
          from wms.warehouse_request_picklist_header header
          join wms.warehouse_request_line line on header.request_header_id= line.request_header_id
          where header.picklist_header_display_id = ?;`;

      const styleResults = await this.connection.query(styleQuery, [displayId]);
      const Style = styleResults.map((item) => item[0].style);
      Style.splice(1);
      const request_header_id = styleResults.map(
        (item) => item[0].request_header_id,
      );
      request_header_id.splice(1);

      const errorPayloadQuery = `SELECT allocation_status.picklist_header_id, material_item_code, allocation_status.external_unique_ref, payload, error_msg, error_code, picklist_allocation_status_id FROM wms.warehouse_request_picklist_header header JOIN wms.warehouse_request_picklist_allocation_status allocation_status ON header.picklist_header_id = allocation_status.picklist_header_id WHERE header.picklist_header_display_id = ? AND allocation_status.is_active = true and error_msg IS NOT NULL;`;

      const errorPayloadResults = await this.connection.query(
        errorPayloadQuery,
        [displayId],
      );

      const picklist_allocation_status_id = errorPayloadResults.map(
        (item) => item[0].picklist_allocation_status_id,
      );
      console.log(picklist_allocation_status_id[0]);

      //getting the picklist_header_id from the errorPayloadResults
      const picklist_header_id = errorPayloadResults.map(
        (item) => item[0].picklist_header_id,
      );
      errorPayloadResults.splice(1);
      if (!errorPayloadResults.length) {
        console.log('No data found');
        return { error: 'No data found' };
      }
      let payloads: any[] = [];
      let results = [];
      results.push(errorPayloadResults[0]);
      let warehouse: any;
      let plantCode: any;
      if (displayId.includes('B03')) {
        plantCode = 'L01';
        warehouse = 'B03';
      } else if (displayId.includes('S00')) {
        plantCode = 'S00S00';
        warehouse = 'S00';
      }
      const url =
        'https://sfcs-gateway-cloud.live.brandixlk.org/sfcs-proxy-service/connectors/allocation/getAllocation';
      const agent = new https.Agent({
        rejectUnauthorized: false,
      });
      for (const result of results[0]) {
        payloads.push(JSON.parse(result.payload));
      }
      for (const payload of payloads) {
        const payloadData: PayloadData = JSON.parse(payload);
        const fromData = payloadData.from;
        const toData = payloadData.to;
        const dataToSend = {
          warehouse: `${warehouse}`,
          rmItemNumber: `${payloadData.itemCode}`,
          style: `${Style}`,
        };
        try {
          const response = await axios.post(url, dataToSend, {
            httpsAgent: agent,
          });
          if (response.data.data.length == 0) {
            console.log(`No allocations found for ${payloadData.itemCode}`);
            return {
              error: `No allocations found for ${payloadData.itemCode}`,
              data: null,
            };
          }
          //if to mos length is 1
          if (toData.mos.length == 1) {
            console.log('there is only one "to" mo');
            for (const get of response.data.data) {
              if (
                get.lot == fromData.lot &&
                get.schedule == toData.mos[0].schedule
              ) {
                if (get.allocationQty < toData.mos[0].quantity) {
                  console.log(
                    `There is a differnce of ${(
                      toData.mos[0].quantity - get.allocationQty
                    ).toFixed(2)}`,
                  );
                } else if (get.allocationQty < toData.mos[0].quantity) {
                  const sendData = `{
                      "picklistHeaderId": ${picklist_header_id}
                      "plantCode": "${plantCode}",
                      "item": {
                          "company": 200,
                          "warehouse": "${warehouse}",
                          "itemCode": "${payloadData.itemCode}",
                          "allocationType": "STYLE",
                          "from": {
                              "lot": "${fromData.lot}",
                              "schedule": "${toData.mos[0].schedule}"
                          },
                          "to": {
                              "mos": [
                                  {
                                      "moNumber": ${toData.mos[0].moNumber},
                                      "vpo": null,
                                      "quantity": ${toData.mos[0].quantity},
                                      "schedule": "${toData.mos[0].schedule}"
                                  }
                              ]
                          }
                      }
                  }`;
                }
              }

              //console.log(sendData);
              // return {
              //   error: null,
              //   data: sendData,
              // };
            }
          } else if (toData.mos.length > 1) {
            const schedule = toData.mos.map((item) => item.schedule);
            console.log(
              `There are ${[...new Set(schedule)].length} different schedules`,
            );
            const moSet: Mo[] = [];
            for (const schedules of [...new Set(schedule)]) {
              let moQtyTotal = 0;
              moSet.splice(0, moSet.length);
              for (const mo of toData.mos) {
                if (mo.schedule == schedules) {
                  moSet.push(mo);
                  moQtyTotal += Number(mo.quantity.toFixed(3));
                }
              }
              let found = false;
              for (const get of response.data.data) {
                if (get.lot == fromData.lot && get.schedule == schedules) {
                  found = true;
                  if (get.allocationQty < moQtyTotal) {
                    console.log(
                      `There is a differnce of ${(
                        moQtyTotal - get.allocationQty
                      ).toFixed(2)}`,
                    );
                  }
                }
              }
              if (!found) {
                return {
                  error: `schedule ${schedules} not found in the allocations`,
                  data: null,
                };
              }
              moQtyTotal = Number(moQtyTotal.toFixed(3));
              console.log(moQtyTotal);
              const sendData = `
        {
            "picklistHeaderId": ${picklist_header_id}
            "plantCode": "${plantCode}",
            "item": {
                "company": 200,
                "warehouse": "${warehouse}",
                "itemCode": "${payloadData.itemCode}",
                "allocationType": "STYLE",
                "from": {
                    "lot": "${fromData.lot}",
                    "schedule": "${schedules}"
                },
                "to": {
                  "mos": [${moSet
                    .map((item) => JSON.stringify(item))
                    .join(', ')}]
                }
            }
        }`;
              console.log(sendData);
              let sfcsKey: any;
              const saveAllocationUrl =
                'https://sfcs-gateway-cloud.live.brandixlk.org/sfcs-proxy-service/connectors/allocation/saveAllocation';
              try {
                const response = await axios.post(
                  saveAllocationUrl,
                  JSON.parse(sendData),
                  {
                    httpsAgent: agent,
                  },
                );
                console.log(response.data.data.success);
                if (response.data.data.success == false) {
                  console.error('Error making POST request:', response.data);
                  return {
                    error: response.data.data.error,
                    data: null,
                  };
                }
                console.log(response.data);
                sfcsKey = response.data.data.sfcsKey;
              } catch (error) {
                console.error('Error making POST request:', error.message);
                throw error;
              }
              let updateData = JSON.stringify(JSON.parse(sendData).item);
              updateData = JSON.stringify(updateData);
              const updateQuery = `INSERT INTO wms.warehouse_request_picklist_allocation_status (picklist_allocation_status, plant_code, warehouse_code,
                is_active, created_at, created_user, updated_user,
                updated_at, version_flag, picklist_header_id,
                material_item_code, external_unique_ref, payload,
                error_code, error_msg, unlock_swap,
                parent_external_unique_ref, retry_stage, get_payload)
                VALUES (1, '${plantCode}', '${warehouse}', 1, DEFAULT, '${updateUser}', null, DEFAULT, 1, ${picklist_header_id} '${
                payloadData.itemCode
              }','${sfcsKey}','${updateData.replace(
                /\\/g,
                '\\\\',
              )}',null, null, 0, null, DEFAULT, null);`;
              const deacativatequery = `UPDATE wms.warehouse_request_picklist_allocation_status t
              SET t.is_active = 0,
              t.updated_user = 'vijendranD'
              WHERE t.picklist_allocation_status_id = ${picklist_allocation_status_id[0]};`;
              const updatePicklist = `UPDATE wms.warehouse_request_picklist_header
              SET picklist_status=2
              WHERE picklist_header_id = '${picklist_header_id}';`;
              const updateRequest = `UPDATE wms.warehouse_request_header
              SET is_suspended=0
              WHERE request_header_id = '${request_header_id}';`;
              this.connection.query(updateQuery);
              this.connection.query(deacativatequery);
              this.connection.query(updatePicklist);
              this.connection.query(updateRequest);
            }
          }
        } catch (error) {
          console.error('Error making POST request:', error.message);
          return {
            error: error.message,
            data: null,
          };
        }
      }
    } catch (error) {
      console.error('No data found', error);
      return { error: 'No data found', data: null };
    }
    return {
      error: null,
      data: 'picklist under not started state.',
    };
  }
}
