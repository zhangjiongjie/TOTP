export class ImportBackupPasswordPromptPolicy {
  static shouldPromptForPassword(message: string): boolean {
    return message.indexOf('备份密码与当前主密码不匹配') >= 0 ||
      message.indexOf('导入加密备份失败') >= 0 ||
      message.indexOf('解密 WebDAV 保管库失败') >= 0 ||
      message.indexOf('AES-GCM') >= 0 ||
      message.indexOf('GCM') >= 0 ||
      message.indexOf('decrypt') >= 0 ||
      message.indexOf('解密') >= 0;
  }
}
