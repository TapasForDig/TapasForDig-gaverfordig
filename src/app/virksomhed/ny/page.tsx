import { redirect } from 'next/navigation';

// Bestillinger laves nu i webshoppen
export default function NewOrder() {
  redirect('/bestil');
}
