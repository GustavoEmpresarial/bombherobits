ALTER TABLE "AdminChange" DROP CONSTRAINT "AdminChange_adminId_fkey";
ALTER TABLE "AdminSession" DROP CONSTRAINT "AdminSession_adminId_fkey";
ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminChange" ADD CONSTRAINT "AdminChange_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
