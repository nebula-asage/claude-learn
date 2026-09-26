/** background scriptからcontent scriptへピッカーの起動/終了切り替えを指示するメッセージ。 */
export interface PickerToggleMessage {
  /** メッセージの種別を識別するタグ。 */
  type: "PICKER_TOGGLE";
}

/** background <-> content 間でやり取りするメッセージの型。 */
export type ExtensionMessage = PickerToggleMessage;
