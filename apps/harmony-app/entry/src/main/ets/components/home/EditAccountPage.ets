import { LocalVault } from '../../model/LocalVault';
import { TotpAccount } from '../../model/TotpAccount';
import { EditAccount } from '../../pages/EditAccount';
import { EditFixedHeader } from './EditFixedHeader';

@Component
export struct EditAccountPage {
  @Prop account: TotpAccount = new TotpAccount('', '', '', '', 6, 30, 'SHA1', 'Default', '', '');
  @Prop headerHeight: number = 76;
  onSaved?: (vault: LocalVault) => void;
  onDeleted?: (vault: LocalVault) => void;
  onBack?: () => void;

  build() {
    Column() {
      EditFixedHeader({
        heightValue: this.headerHeight,
        onBack: () => {
          if (this.onBack) {
            this.onBack();
          }
        }
      })

      EditAccount({
        account: this.account,
        topInset: 0,
        bottomInset: 116,
        onSaved: (vault: LocalVault) => {
          if (this.onSaved) {
            this.onSaved(vault);
          }
        },
        onDeleted: (vault: LocalVault) => {
          if (this.onDeleted) {
            this.onDeleted(vault);
          }
        },
        onBack: () => {
          if (this.onBack) {
            this.onBack();
          }
        }
      })
    }
    .width('100%')
    .height('100%')
  }
}
