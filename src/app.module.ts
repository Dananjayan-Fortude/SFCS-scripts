import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { MyConfigModule } from 'config.module';
import { DatabaseService } from './database/database.service';

@Module({
  imports: [DatabaseModule, MyConfigModule],
  controllers: [AppController],
  providers: [AppService, DatabaseService],
})
export class AppModule {}
