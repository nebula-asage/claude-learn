// background <-> content 間でやり取りするメッセージの型。
export interface PickerToggleMessage {
  type: "PICKER_TOGGLE";
}

export type ExtensionMessage = PickerToggleMessage;
