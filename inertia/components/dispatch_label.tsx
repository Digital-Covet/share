import { Separator } from '@base-ui/react/separator'

/**
 * Decorative shipping label for the sign-in aside. Purely presentational:
 * hidden from assistive tech, ignores the pointer, and every value on it is
 * static placeholder text.
 */
export default function DispatchLabel() {
  return (
    <div aria-hidden="true" className="dispatch">
      <div className="dispatch__head label-mono">
        <span>Dispatch</span>
        <span className="tabular-nums">CD-0000-2648</span>
      </div>

      <dl className="dispatch__fields">
        <div>
          <dt className="label-mono">From</dt>
          <dd>you@digitalcovet.com</dd>
        </div>
        <div>
          <dt className="label-mono">To</dt>
          <dd>a colleague</dd>
        </div>
        <div>
          <dt className="label-mono">Contents</dt>
          <dd>3 files · 48.2 MB</dd>
        </div>
        <div>
          <dt className="label-mono">Expires</dt>
          <dd>in 7 days</dd>
        </div>
      </dl>

      <Separator className="dispatch__rule" />

      <div className="dispatch__foot">
        <span className="dispatch__barcode" />
        <span className="dispatch__stamp label-mono">Signed for</span>
      </div>
    </div>
  )
}
