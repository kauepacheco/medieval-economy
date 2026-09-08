export function VillageScene() {
  return (
    <svg className="village-scene" viewBox="0 0 1000 330" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="sky" x2="0" y2="1"><stop stopColor="#dce3ca"/><stop offset="1" stopColor="#f2e8c9"/></linearGradient>
        <linearGradient id="land" x2="0" y2="1"><stop stopColor="#73886a"/><stop offset="1" stopColor="#344f3c"/></linearGradient>
        <g id="pine"><path d="M0 0l-18 35h9l-18 30h20v16H7V65h20L9 35h9z" fill="#344e3e"/></g>
        <g id="house"><path d="M-35 0h70v47h-70z" fill="#dfcba3"/><path d="M-44 3L0-35 44 3z" fill="#79654e"/><path d="M-26 4v42M26 4v42M-34 26h68M0 4v42" stroke="#8a785c" strokeWidth="5"/><path d="M-8 24h16v23H-8z" fill="#465144"/><path d="M-26 9h12v12h-12zM14 9h12v12H14z" fill="#697b6a"/><path d="M17-23v-17h10v26" fill="#a99b7c"/></g>
      </defs>
      <path fill="url(#sky)" d="M0 0h1000v330H0z"/>
      <circle cx="730" cy="67" r="36" fill="#f8ecc5"/>
      <path d="M0 144L113 56l101 80L327 50l131 117 131-74 91 61L820 73l180 103v154H0z" fill="#bcc8b0"/>
      <path d="M0 192Q150 71 301 157T611 170T1000 142v188H0z" fill="#94a589"/>
      <path d="M0 223Q155 145 369 207T720 188T1000 211v119H0z" fill="url(#land)"/>
      <path d="M477 330q-40-58 62-90t45-52" fill="none" stroke="#c5bb92" strokeWidth="29"/>
      <path d="M543 249l-154-37M561 225l163 18" fill="none" stroke="#c5bb92" strokeWidth="12"/>
      <g opacity=".8"><use href="#pine" x="70" y="129"/><use href="#pine" x="109" y="146"/><use href="#pine" x="43" y="160"/><use href="#pine" x="850" y="107"/><use href="#pine" x="887" y="131"/><use href="#pine" x="919" y="108"/><use href="#pine" x="953" y="154"/></g>
      <path d="M274 236l74-40 111 37-74 48z" fill="#bda773"/><path d="M291 237l73 25m-54-36l73 25m-53-35l73 25m-53-35l73 25m-53-35l73 25" stroke="#8c8556" strokeWidth="5"/>
      <use href="#house" transform="translate(465 167) scale(1.15)"/><use href="#house" transform="translate(612 140) scale(.8)"/><use href="#house" transform="translate(696 202) scale(.85)"/>
      <path d="M568 181h28v31h-28z" fill="#b5aa88"/><path d="M560 181l22-19 22 19z" fill="#71654e"/><path d="M571 185h22v15h-22z" fill="#566450"/>
      <g stroke="#c8ba92" strokeWidth="4"><path d="M659 260l96-17M659 251l96-17M664 245v24m27-30v25m28-30v25m29-31v25"/></g>
      <g fill="#92978a"><path d="M767 256l17-28 31 1 15 33-29 11z"/><path d="M816 269l12-21 26 6 9 20z"/><path d="M771 280l6-14 16 4 4 12z"/></g>
      <g fill="#b7b7a0"><path d="M784 228l9 25 22-24z"/><path d="M828 248l10 16 16-10z"/></g>
      <use href="#pine" transform="translate(180 198) scale(1.3)"/><use href="#pine" transform="translate(223 229) scale(1.2)"/><use href="#pine" transform="translate(131 230) scale(1.6)"/><use href="#pine" transform="translate(925 230) scale(1.5)"/>
      <path d="M0 306q111-35 211 24H0M753 330q161-50 247-25v25" fill="#304a38"/>
      <g fill="#e5c996"><circle cx="528" cy="261" r="3"/><path d="M525 265h6l2 10h-10z"/><circle cx="627" cy="232" r="3"/><path d="M624 236h6l2 10h-10z"/></g>
      <path d="M347 69q6-6 12 0 6-6 12 0m33 19q5-5 10 0 5-5 10 0" fill="none" stroke="#7e9078" strokeWidth="2"/>
    </svg>
  );
}
