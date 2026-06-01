import { TotpAccount } from '../../model/TotpAccount';
import { AccountCard } from './AccountCard';
import { TotpCodeSnapshot } from '../../services/TotpRuntimeService';

@Component
export struct HomeAccountSection {
  @Prop isLoading: boolean = false;
  @Prop accounts: TotpAccount[] = [];
  @Prop snapshots: TotpCodeSnapshot[] = [];
  onCopy?: (accountId: string) => void;
  onEdit?: (accountId: string) => void;

  build() {
    Column({ space: 10 }) {
      if (this.isLoading) {
        Text($r('app.string.home_loading'))
          .fontSize(13)
          .fontColor($r('sys.color.font_secondary'))
          .width('100%')
      } else if (this.accounts.length === 0) {
        this.buildEmptyState()
      } else {
        ForEach(this.accounts, (account: TotpAccount) => {
          AccountCard({
            account: account,
            codeValue: this.resolveSnapshot(account.id).codeValue,
            codeHint: this.resolveSnapshot(account.id).codeHint,
            countdownLabel: this.resolveSnapshot(account.id).countdownLabel,
            statusLabel: this.resolveSnapshot(account.id).statusLabel,
            onCopy: (accountId: string) => {
              if (this.onCopy) {
                this.onCopy(accountId);
              }
            },
            onEdit: (accountId: string) => {
              if (this.onEdit) {
                this.onEdit(accountId);
              }
            }
          })
        }, (account: TotpAccount) => account.id)
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }

  @Builder
  private buildEmptyState(): void {
    Column({ space: 10 }) {
      Text($r('app.string.home_empty_title'))
        .fontSize(18)
        .fontWeight(FontWeight.Medium)
        .fontColor($r('sys.color.font_primary'))

      Text($r('app.string.home_empty_body'))
        .fontSize(14)
        .lineHeight(22)
        .fontColor($r('sys.color.font_secondary'))
        .textAlign(TextAlign.Center)
    }
    .width('100%')
    .padding({ left: 20, right: 20, top: 28, bottom: 28 })
    .backgroundColor($r('sys.color.comp_background_tertiary'))
    .borderRadius(24)
  }

  private resolveSnapshot(accountId: string): TotpCodeSnapshot {
    for (let index: number = 0; index < this.snapshots.length; index++) {
      if (this.snapshots[index].accountId === accountId) {
        return this.snapshots[index];
      }
    }
    return new TotpCodeSnapshot(accountId, '', '------', '', '30s / 30s', '');
  }
}
