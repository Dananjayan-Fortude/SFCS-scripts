import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { MyConfigModule } from 'config.module';
import { DatabaseService } from './database/database.service';
import { CplUpdateModule } from './cpl_update/cpl_update.module';
import { FromlotModule } from './fromlot/fromlot.module';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    DatabaseModule,
    MyConfigModule,
    CplUpdateModule,
    FromlotModule,
    TypeOrmModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [AppService, DatabaseService],
})
export class AppModule {}
