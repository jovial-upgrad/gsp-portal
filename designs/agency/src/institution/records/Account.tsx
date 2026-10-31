import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';

/** The account, on phones (the initials in the top bar): who's signed in, and Sign out. A GSP admin manages access. */
export function AccountPage({ name, org, email, onSignOut }: { name: string; org: string; email: string; onSignOut: () => void }) {
  const initials = name.split(' ').map((p) => p[0]).slice(0, 2).join('');
  return (
    <div className="ipage">
      <header className="stu__head">
        <div className="stu__titles">
          <h1 className="page__title">Account</h1>
          <p className="stu__lead">Your GSP admin gives and removes access to the Institution Team.</p>
        </div>
      </header>
      <section className="card acard iacct" aria-label="Signed in as">
        <span className="savatar iacct__av" aria-hidden="true">
          {initials}
        </span>
        <div className="iacct__t">
          <p className="iacct__name">{name}</p>
          <p className="iacct__org">{org}</p>
          <p className="iacct__mail">{email}</p>
        </div>
        <Button variant="secondary" iconLeft={<Icon name="logout" size={18} />} onClick={onSignOut}>
          Sign out
        </Button>
      </section>
    </div>
  );
}
