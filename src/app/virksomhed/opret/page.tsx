import { redirect } from 'next/navigation';

// Virksomhedskonti oprettes kun gennem en bestilling, hvor e-mailen bekræftes via link.
// En åben oprettelse gjorde det muligt at "reservere" en andens e-mail og overtage deres bestillinger.
export default function CompanySignup() {
  redirect('/bestil');
}
