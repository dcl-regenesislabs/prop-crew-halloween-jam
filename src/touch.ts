// The phone's own buttons. Playtest feedback (2026-10-09): no jump, the big button is the main action, a small
// button drops what you hold, and the big button's picture follows what you face: "hold" at the grinder and the
// pump, a hand everywhere else.
// The client keeps its buttons in a fixed priority stack (jump, pointer, E, F, 1, 2, 3, 4); a scene can only choose
// which one leads, which are hidden and what picture each wears. So: E (IA_PRIMARY) leads, 1 (IA_ACTION_3) is the
// small drop button while something is held, everything else is hidden. On desktop this component does nothing.
import { engine, InputAction, TouchScreenControls } from '@dcl/sdk/ecs'

const icon = (file: string) => ({ tex: { $case: 'texture' as const, texture: { src: 'assets/Images/' + file } } })
const UNUSED = [InputAction.IA_JUMP, InputAction.IA_POINTER, InputAction.IA_SECONDARY, InputAction.IA_ACTION_4, InputAction.IA_ACTION_5, InputAction.IA_ACTION_6]
const ALL = [...UNUSED, InputAction.IA_PRIMARY, InputAction.IA_ACTION_3]

export type TouchState = {
  modal: boolean // the guide covers the screen: every control steps aside
  inside: boolean // in the shed (fixed overhead camera: no crosshair)
  hold: boolean // the main action here is press-and-hold (grinder or pump with the right prop)
  holding: boolean // something in the hands: the drop button shows
}

let applied = 'unset' // not '' : that is the lot's own key, and it must be written once too
export function applyTouch(s: TouchState) {
  const key = (s.modal ? 'm' : '') + (s.inside ? 'i' : '') + (s.hold ? 'h' : '') + (s.holding ? 'd' : '')
  if (key === applied) return
  applied = key
  if (s.modal) {
    TouchScreenControls.createOrReplace(engine.RootEntity, {
      hideJoystick: true,
      hideCrosshair: true,
      mainAction: InputAction.IA_PRIMARY,
      touchInputs: ALL.map((inputAction) => ({ inputAction, hide: true }))
    })
    return
  }
  TouchScreenControls.createOrReplace(engine.RootEntity, {
    hideJoystick: false,
    hideCrosshair: s.inside,
    mainAction: InputAction.IA_PRIMARY,
    touchInputs: [
      ...UNUSED.map((inputAction) => ({ inputAction, hide: true })),
      { inputAction: InputAction.IA_PRIMARY, hide: false, icon: icon(s.hold ? 'btn-hold.png' : 'btn-hand.png') },
      { inputAction: InputAction.IA_ACTION_3, hide: !(s.inside && s.holding), icon: icon('btn-drop.png') }
    ]
  })
}
