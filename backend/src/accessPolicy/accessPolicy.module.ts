import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AccessPolicyService } from "./accessPolicy.service";

@Module({
  imports: [JwtModule.register({})],
  providers: [AccessPolicyService],
  exports: [AccessPolicyService],
})
export class AccessPolicyModule {}
