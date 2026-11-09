import type { InputHTMLAttributes } from "react";

// Champ de formulaire avec son libellé. Le libellé entoure le champ,
// donc un lecteur d'écran les relie sans identifiant à gérer.
export const CLASSE_CHAMP =
  "h-12 w-full rounded-[10px] border-[1.5px] border-bordure bg-white px-3.5 text-base font-normal text-encre";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  libelle: string;
  aide?: string;
};

export default function Champ({ libelle, aide, ...champ }: Props) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-semibold">
      {libelle}
      <input {...champ} className={CLASSE_CHAMP} />
      {aide ? (
        <span className="text-[12.5px] font-normal leading-snug text-discret">
          {aide}
        </span>
      ) : null}
    </label>
  );
}
