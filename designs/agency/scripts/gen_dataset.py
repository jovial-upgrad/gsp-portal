"""
Builds src/data/dataset.json: one set of applications every module reads.
Inputs: the work sample (47 CRM-shaped applications) and Finance's demo enrolments (30), plus the catalogue
and Finance terms. Deterministic: run again and the output is the same.
"""
import json, re, hashlib, sys
import os
SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src')
W = json.load(open(f'{SRC}/work/sample.json'))
C = json.load(open(f'{SRC}/finance/comm.json'))
STAFF = json.load(open(f'{SRC}/data/staff.json'))
courses_ts = open(f'{SRC}/data/courses.ts').read()

def h(s, n):  # stable pseudo-random int in [0, n)
    return int(hashlib.md5(s.encode()).hexdigest()[:8], 16) % n

norm = lambda x: re.sub(r'[^a-z]', '', re.sub(r'\(.*?\)', '', x.lower()).replace('the ', ''))

# ---------- the catalogue's universities ----------
CAT = re.findall(r"\{ id: '([a-z-]+)', name: '([^']+)', (?:aka: \[([^\]]*)\], )?country: '([A-Za-z ]+)'", courses_ts)
CAT = [{'id': i, 'name': n, 'aka': re.findall(r"'([^']+)'", a or ''), 'country': c} for i, n, a, c in CAT]
FCOUNTRY = {'AU': 'Australia', 'NZ': 'New Zealand', 'UK': 'UK', 'IE': 'Ireland', 'CA': 'Canada', 'US': 'USA'}
FCODE = {v: k for k, v in FCOUNTRY.items()}
FUNIS = C['cfg']['unis']

def cat_match(name):
    n = norm(name)
    for u in CAT:
        for x in [u['name']] + u['aka']:
            if norm(x) == n:
                return u
    return None

def fin_match(name):
    n = norm(name)
    for u in FUNIS:
        if norm(u['name']) == n:
            return u
    for u in FUNIS:
        m = norm(u['name'])
        if (m.startswith(n) or n.startswith(m)) and 'college' not in m and 'via' not in u['name']:
            return u
    return None

# catalogue uni -> Finance terms id
link = {}
for u in CAT:
    f = fin_match(u['name']) or next((f for f in FUNIS for a in u['aka'] if norm(f['name']) == norm(a)), None)
    if u['id'] == 'griffith':
        f = None  # Griffith College (Ireland) is not Griffith University (Australia)
    if u['id'] == 'massey':
        f = next(x for x in FUNIS if x['id'] == '22')
    if f:
        link[u['id']] = f['id']

# universities the applications use that the catalogue doesn't have yet: added to it
CITY = {'01': 'Adelaide', '03': 'Auckland', '06': 'Perth', '08': 'Darwin', '11': 'Perth', '13': 'Melbourne', '14': 'Wellington', '15': 'London', '16': 'Armidale',
        '18': 'Brisbane', '21a': 'Sydney', '23': 'Melbourne', '25': 'Brisbane', '26': 'Gold Coast', '27': 'Sydney', '29': 'Hobart', '31a': 'Auckland', '33': 'Brisbane',
        '36': 'Paisley', '37': 'Wagga Wagga', '39': 'Sydney', '09': 'Sydney'}
# CRM universities with no Finance terms (kept, so Finance shows "no terms" for them)
NOTERMS = {'The University of Notre Dame Australia': ('notredame', 'University of Notre Dame Australia', 'Australia', 'Fremantle'),
           'TAFE SA': ('tafesa', 'TAFE SA', 'Australia', 'Adelaide'),
           'Macquarie University': ('macquarie', 'Macquarie University', 'Australia', 'Sydney'),
           'University of Wales Trinity Saint David': ('uwtsd', 'University of Wales Trinity Saint David', 'UK', 'London'),
           'Engineering Institute of Technology (EIT)': ('eit', 'Engineering Institute of Technology', 'Australia', 'Perth'),
           'Curtin College': ('curtincollege', 'Curtin College', 'Australia', 'Perth'),
           'The University of Winchester': ('winchester', 'University of Winchester', 'UK', 'Winchester'),
           'Toi Ohomai Institute of Technology': ('toiohomai', 'Toi Ohomai Institute of Technology', 'New Zealand', 'Tauranga'),
           'Australian Catholic University': ('acu', 'Australian Catholic University', 'Australia', 'Sydney'),
           'TAFE International Western Australia': ('tafewa', 'TAFE International Western Australia', 'Australia', 'Perth'),
           'Greenwich College': ('greenwichcollege', 'Greenwich College', 'Australia', 'Sydney')}
# not a GSP destination: these CRM applications move to a destination GSP has
MOVE = {'Schiller International University': 'London Metropolitan University', 'Asia Pacific University of Technology & Innovation (APU)': 'London Metropolitan University'}
COLLEGE = {'27', 'tafesa', 'tafewa', 'greenwichcollege', 'curtincollege', 'eit', 'toiohomai', '21a', '31a'}

added = {}   # new catalogue id -> uni
SLUG = {'University of Tasmania': 'utas', 'University of the West of Scotland': 'uws', 'Victoria University of Wellington': 'vuw', 'Auckland University of Technology': 'aut',
        'University of Western Australia': 'uwa', 'Edith Cowan University': 'ecu', 'Southern Cross University': 'scu', 'Auckland Institute of Studies': 'ais', 'Kaplan Business School': 'kbs',
        'Western Sydney University': 'wsu', 'Griffith University': 'griffithu', 'La Trobe University': 'latrobe', 'London Metropolitan University': 'londonmet', 'Charles Darwin University': 'cdu',
        'TAFE NSW': 'tafensw', 'Torrens University Australia': 'torrens', 'Swinburne University of Technology': 'swinburne', 'Charles Sturt University': 'csu'}
def slug(name):
    if name in SLUG: return SLUG[name]
    return re.sub(r'[^a-z0-9]+', '', name.lower().replace('university', 'u').replace('the ', ''))[:14]

def resolve_uni(name):
    """The catalogue university id for a CRM or Finance university name, adding it when needed."""
    name = MOVE.get(name, name)
    CAT_ALIAS = {'Griffith College Ireland': 'griffith', 'The University of Greenwich': 'greenwich', 'The University of Waikato': 'waikato'}
    if name in CAT_ALIAS:
        return CAT_ALIAS[name]
    c = cat_match(name)
    if c and not (c['id'] == 'griffith' and 'College' not in name):
        return c['id']
    if name in NOTERMS:
        i, n, country, city = NOTERMS[name]
        added.setdefault(i, {'id': i, 'name': n, 'country': country, 'city': city, 'fin': None, 'college': i in COLLEGE})
        return i
    f = fin_match(name)
    if not f:
        sys.exit(f'no university for {name}')
    i = next((k for k, v in link.items() if v == f['id']), None)
    if i:
        return i
    nm = re.sub(r'\s*\((?:UP|via Kaplan NZ|Kaplan)\)', '', f['name'])
    i = slug(nm)
    added.setdefault(i, {'id': i, 'name': nm, 'country': FCOUNTRY.get(f['country'], 'Australia'), 'city': CITY.get(f['id'], 'Sydney'), 'fin': f['id'], 'college': f['id'] in COLLEGE})
    link[i] = f['id']
    return i

def fin_by_id(fid):
    return next(f for f in FUNIS if f['id'] == fid)

# ---------- levels ----------
def level_of(course):
    c = course.lower()
    if re.search(r'doctor|phd', c): return 'PhD or research'
    if re.search(r'by research|research studies', c): return 'PhD or research'
    if re.search(r'graduate diploma|graduate certificate|qualifying', c): return 'Postgraduate diploma'
    if re.search(r'master|mba|msc|global master', c): return 'Master’s degree'
    if re.search(r'diploma|certificate', c): return 'Diploma'
    if re.search(r'foundation', c): return 'Foundation'
    return 'Bachelor’s degree'
FLEVEL = {'Master’s degree': 'PG', 'Postgraduate diploma': 'PG', 'PhD or research': 'RES', 'Bachelor’s degree': 'UG', 'Diploma': 'DIP', 'Foundation': 'FDN'}
LEVEL_OF_F = {'PG': 'Master’s degree', 'UG': 'Bachelor’s degree', 'RES': 'PhD or research', 'DIP': 'Diploma', 'FDN': 'Foundation', 'VET': 'Diploma', 'ELICOS': 'Diploma', 'SA': 'Bachelor’s degree'}
FIN_COURSE = {'PG': ['Master of Business Administration', 'Master of Information Technology', 'Master of Professional Accounting', 'Master of Data Science', 'Master of Public Health'],
              'UG': ['Bachelor of Business', 'Bachelor of Information Technology', 'Bachelor of Nursing', 'Bachelor of Engineering (Honours)'],
              'RES': ['Master of Philosophy'], 'DIP': ['Diploma of Business', 'Diploma of Information Technology'], 'FDN': ['Foundation Studies'], 'VET': ['Diploma of Leadership and Management'], 'ELICOS': ['General English'], 'SA': ['Study Abroad']}

# ---------- statuses ----------
STATUS_KEY = {'Ready to submit': 'ready', 'Enrolment confirmation pending': 'enrolconf', 'Finance and background check': 'finance', 'Payment proof under review': 'payreview',
              'Unconditional offer letter received': 'uol', 'Conditional offer received, conditions pending': 'conditions', 'Visa decision pending': 'visasub',
              'Visa lodgement pending': 'visa', 'Document re-upload pending': 'reupload', 'Pending verification': 'checking', 'Submitted to university': 'lodged',
              'Tuition or deposit pending': 'deposit'}

# ---------- people ----------
by_role_region = lambda role, region: [s for s in STAFF if s['role'] == role and region in s['regions']]
def officer_for(region, key):
    ppl = by_role_region('Admission', region) or by_role_region('Admission Ops', 'Global')
    return ppl[h(key, len(ppl))]['id']
NAT = {'India': 'India', 'Bangladesh': 'Bangladesh', 'Nepal': 'Nepal', 'Sri Lanka': 'Sri Lanka', 'Pakistan': 'Pakistan', 'Vietnam': 'Vietnam', 'Philippines': 'Philippines',
       'Australia': 'India', 'Indonesia, Malaysia and Thailand': 'Indonesia', 'Africa': 'Nigeria', 'Latin America and Europe': 'Colombia', 'Myanmar': 'Myanmar', 'Bhutan': 'Bhutan', 'Direct': 'India', 'China': 'China'}
DIAL = {'India': '+91', 'Bangladesh': '+880', 'Nepal': '+977', 'Sri Lanka': '+94', 'Pakistan': '+92', 'Vietnam': '+84', 'Philippines': '+63', 'Indonesia': '+62', 'Nigeria': '+234', 'Colombia': '+57', 'Myanmar': '+95', 'Ghana': '+233', 'Kenya': '+254', 'China': '+86', 'Mauritius': '+230'}
FIN_REGION = {'Australia Onshore': 'Australia'}

# ---------- RPs ----------
rps = {}
for r in C['cfg']['rps']:
    rps[r['id']] = {'id': r['id'], 'name': re.sub(r'^Sample: ', '', r['name']).replace(' (Master Partner)', ''), 'region': FIN_REGION.get(r['region'], r['region']), 'terms': True}
def rp_of(rid, name, region):
    if rid not in rps:
        rps[rid] = {'id': rid, 'name': name.strip(), 'region': region, 'terms': False}
    return rps[rid]

# W31/W21 (1 Nov): each RP's city, the date it joined, and its team (an admin and a counsellor, invented names),
# so the RP's Profile, GSP's RP contact and the Recruitment partners page show the same people
RP_CITY = {'India': ['Bengaluru', 'Hyderabad', 'Chennai', 'Pune', 'Ahmedabad', 'Kochi', 'Chandigarh', 'Jaipur'], 'Australia': ['Melbourne', 'Sydney', 'Brisbane', 'Adelaide', 'Perth'],
           'Vietnam': ['Ho Chi Minh City', 'Hanoi', 'Da Nang'], 'Nepal': ['Kathmandu', 'Pokhara'], 'Bangladesh': ['Dhaka', 'Chattogram'], 'Sri Lanka': ['Colombo', 'Kandy'],
           'Pakistan': ['Lahore', 'Karachi', 'Islamabad'], 'Philippines': ['Manila', 'Cebu City'], 'Indonesia, Malaysia and Thailand': ['Jakarta', 'Kuala Lumpur', 'Bangkok'],
           'Africa': ['Lagos', 'Accra', 'Nairobi'], 'Latin America and Europe': ['Bogotá', 'Lima'], 'Myanmar': ['Yangon'], 'Bhutan': ['Thimphu'], 'China': ['Shanghai', 'Beijing'], 'Direct': ['Melbourne']}
RP_PEOPLE = {'India': (['Anil', 'Deepa', 'Suresh', 'Lata', 'Manoj', 'Rekha', 'Prakash', 'Geeta'], ['Iyer', 'Kulkarni', 'Bhat', 'Pillai', 'Rao', 'Hegde', 'Menon', 'Joshi']),
             'Australia': (['Tom', 'Sarah', 'Liam', 'Grace', 'Nathan', 'Chloe'], ['Walsh', 'Bennett', 'Hughes', 'Fraser', 'Doyle', 'Carter']),
             'Vietnam': (['Minh', 'Hoa', 'Tuan', 'Linh'], ['Tran', 'Le', 'Pham', 'Vo']), 'Nepal': (['Sagar', 'Pooja', 'Rabin'], ['Shrestha', 'Adhikari', 'Karki']),
             'Bangladesh': (['Farhan', 'Nadia', 'Imran'], ['Rahman', 'Akter', 'Chowdhury']), 'Sri Lanka': (['Kasun', 'Dilani', 'Nuwan'], ['Fernando', 'Wickrama', 'Dias']),
             'Pakistan': (['Bilal', 'Sana', 'Usman'], ['Qureshi', 'Butt', 'Siddiqui']), 'Philippines': (['Miguel', 'Ana', 'Jose'], ['Santos', 'Cruz', 'Garcia']),
             'China': (['Wei', 'Jing'], ['Zhang', 'Liu'])}
RP_DIAL = {'India': '+91', 'Australia': '+61', 'Vietnam': '+84', 'Nepal': '+977', 'Bangladesh': '+880', 'Sri Lanka': '+94', 'Pakistan': '+92', 'Philippines': '+63', 'China': '+86',
           'Indonesia, Malaysia and Thailand': '+62', 'Africa': '+234', 'Latin America and Europe': '+57', 'Myanmar': '+95', 'Bhutan': '+975', 'Direct': '+61'}
# the GSP test agency (HC13, 1 Nov): its team, its branches, and its own students and applications
# (scripts/test_agency.json: times are "@now±days", "{officer}" is the application's officer, "{me}" who signs in)
TEST_TEAM = [
    {'key': 'me', 'name': 'Nesil Noble', 'email': 'nesil@upgard.com', 'dial': '+91', 'phone': '98450 12345', 'role': 'RP Admin', 'branch': 'hq'},
    {'key': 'anita', 'name': 'Anita Desai', 'email': 'anita.desai@gsptestagency.in', 'dial': '+91', 'phone': '98201 55408', 'role': 'Branch Admin', 'branch': 'mumbai'},
    {'key': 'karthik', 'name': 'Karthik Nair', 'email': 'karthik.nair@gsptestagency.in', 'dial': '+91', 'phone': '98450 22113', 'role': 'Counsellor', 'branch': 'hq'},
    {'key': 'divya', 'name': 'Divya Shetty', 'email': 'divya.shetty@gsptestagency.in', 'dial': '+91', 'phone': '98201 76420', 'role': 'Counsellor', 'branch': 'mumbai'},
]
TEST_BRANCHES = [
    {'id': 'hq', 'name': 'Bengaluru head office', 'country': 'India', 'state': 'Karnataka', 'city': 'Bengaluru', 'main': True},
    {'id': 'mumbai', 'name': 'Mumbai', 'country': 'India', 'state': 'Maharashtra', 'city': 'Mumbai'},
]
TEST_OWN = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'test_agency.json')))

def rp_details(r):
    key = r['id']
    if key == 'R-TEST':
        # the designer's agency, signed in as RP Admin (HC13, 1 Nov): its one team record and its branches, here like
        # every other RP's. `key` is the member's id in the portal ('me' is whoever signs in as its RP Admin).
        r.update({'city': 'Bengaluru', 'state': 'Karnataka', 'country': 'India', 'since': '2024-06-10', 'team': TEST_TEAM, 'branches': TEST_BRANCHES})
        return
    cities = RP_CITY.get(r['region'], ['Melbourne'])
    r['city'] = cities[h(key + 'c', len(cities))]
    y, m, d = 2023 + h(key + 'y', 3), 1 + h(key + 'm', 12), 1 + h(key + 'd', 28)
    r['since'] = f'{y}-{m:02d}-{d:02d}'
    firsts, lasts = RP_PEOPLE.get(r['region'], RP_PEOPLE['Australia'])
    dom = re.sub(r'[^a-z]', '', re.sub(r'\b(pty|ltd|pvt|private|limited|consultancy|consultants|services)\b', '', r['name'].lower()))[:18] or 'agency'
    dial = RP_DIAL.get(r['region'], '+61')
    def who(i):
        f, l = firsts[h(key + str(i) + 'f', len(firsts))], lasts[h(key + str(i) + 'l', len(lasts))]
        return {'name': f'{f} {l}', 'email': f'{f.lower()}@{dom}.com', 'dial': dial, 'phone': f'{h(key + str(i) + "p", 90000) + 10000} {h(key + str(i) + "q", 90000) + 10000}'}
    a, c = who(0), who(1)
    if c['name'] == a['name']:
        c = who(2)
    r['team'] = [{**a, 'role': 'RP Admin'}, {**c, 'role': 'Counsellor'}]

# ---------- students and applications ----------
students, apps, idmap = [], [], {}
# a student never shares a name with a GSP person or an RP's team member
TAKEN = {(x['first'] + ' ' + x['last']).lower() for x in STAFF} | {'rahul verma', 'sneha kulkarni', 'karthik nair', 'divya shetty', 'nesil noble', 'anita desai', 'ananya rao', 'vikram desai', 'lan tran', 'asha menon', 'priya raman', 'kavya menon'}
RENAME = {'Rahul Verma': 'Rahul Varghese', 'Sneha Kulkarni': 'Sneha Kale', 'Ananya Rao': 'Ananya Rajan'}
# W29 (1 Nov): two students never share a name, nor share one with the sample agency's own students (two Rohan Guptas
# read as one person): a repeat takes another surname from its nationality's list
SAMPLE_STUDENTS = {'mohammed irfan', 'priya raman', 'sneha patil', 'rohan gupta', 'fatima sheikh'}
SURNAMES = {'India': ['Bhatia', 'Chopra', 'Desai', 'Gill', 'Kapoor', 'Mehta', 'Saxena', 'Thakur', 'Verghese', 'Sethi'], 'Bangladesh': ['Sarker', 'Hasan', 'Mia', 'Karim'],
            'Pakistan': ['Raza', 'Javed', 'Anwar'], 'Sri Lanka': ['Perera', 'Silva', 'Gunawardena', 'Rajapaksha'], 'Vietnam': ['Hoang', 'Dang', 'Bui', 'Do'], 'Nepal': ['Gurung', 'Rai', 'Magar'],
            'Philippines': ['Reyes', 'Bautista', 'Mendoza'], 'Indonesia': ['Wijaya', 'Santoso'], 'Nigeria': ['Okeke', 'Adeyemi'], 'Colombia': ['Rojas', 'Herrera'], 'Myanmar': ['Aung', 'Htun']}
USED = set(SAMPLE_STUDENTS)
def student(first_last, nat, rp, key):
    first_last = RENAME.get(first_last, first_last)
    if first_last.lower() in TAKEN:
        sys.exit(f'student name {first_last} is also a person on the team')
    if first_last.lower() in USED:
        first = first_last.split(' ')[0]
        pool = SURNAMES.get(nat, SURNAMES['India'])
        first_last = next(f'{first} {x}' for x in pool[h(key, len(pool)):] + pool if f'{first} {x}'.lower() not in USED | TAKEN)
    USED.add(first_last.lower())
    parts = first_last.split(' ')
    first, last = parts[0], ' '.join(parts[1:]) or parts[0]
    sid = f'S-3{len(students) + 1:04d}'
    students.append({'id': sid, 'first': first, 'last': last, 'nationality': nat, 'email': f"{first.lower()}.{re.sub(r'[^a-z]', '', last.lower())}{h(key, 90) + 10}@gmail.com",
                     'dial': DIAL.get(nat, '+91'), 'phone': f'{h(key + "p", 90000) + 10000} {h(key + "q", 90000) + 10000}', 'passport': f'{chr(65 + h(key, 26))}{h(key + "x", 9000000) + 1000000}', 'rp': rp})
    return sid

# 1. CRM-shaped applications from the work sample (open, at every stage)
n = 24200
for r in W['records']:
    n += 1
    new = f'GSP-{n}'
    idmap[r['id']] = new
    region = r['region']
    rp = rp_of(r['rpId'], r['agency'], region)
    uni = resolve_uni(r['uni'])
    nat = NAT.get(region, 'India')
    sid = student(r['student'], nat, rp['name'], r['id'])
    apps.append({'id': new, 'was': r['id'], 'rp': rp['name'], 'rpId': rp['id'], 'region': region, 'studentId': sid, 'uni': uni, 'course': r['course'].strip(), 'level': level_of(r['course']),
                 'intake': r['intake'], 'status': STATUS_KEY[r['status']], 'sinceDays': r['sinceDays'], 'officer': r.get('officer') or officer_for(region, r['id'])})

# 2. Finance's enrolments (enrolled, with commission): the sample agency's own become its students
n = 22100
for a in C['apps'].values():
    n += 1
    new = f'GSP-{n}'
    idmap[a['id']] = new
    f = fin_by_id(a['uni'])
    uni = resolve_uni(f['name'])
    own = a['rp'] == 'R-TEST'
    rp = None if own else rps[a['rp']]
    region = 'India' if own else (rp['region'] if rp['region'] in NAT else 'Australia')
    nat = a.get('nationality') or NAT.get(region, 'India')
    sid = student(a['student'], nat, None if own else rp['name'], a['id'])
    names = FIN_COURSE.get(a['level'], ['Master of Business Administration'])
    apps.append({'id': new, 'was': a['id'], 'rp': None if own else rp['name'], 'rpId': a['rp'], 'region': region, 'studentId': sid, 'uni': uni, 'course': names[h(a['id'], len(names))],
                 'level': LEVEL_OF_F.get(a['level'], 'Master’s degree'), 'intakeDate': a['intake'], 'status': 'closed' if a.get('withdrawn') else 'enrolled',
                 'withdrawn': a.get('withdrawn'), 'sinceDays': None, 'officer': officer_for(region, a['id']),
                 'fin': {'studentType': a.get('studentType', 'New'), 'gspLead': a.get('gspLead', False), 'scholarshipPct': 0, 'pay': 'auto', 'courseYears': a.get('courseYears')}})

# a few Finance situations worth showing, by application
special = {'GSP-22104': 'overdue', 'GSP-22111': 'short', 'GSP-22117': 'overdue', 'GSP-22125': 'invoiced',
           # the university paid this week, so the RP's line is in the next payout run
           'GSP-22102': 'ready', 'GSP-22106': 'ready', 'GSP-22109': 'ready', 'GSP-22113': 'ready', 'GSP-22118': 'ready', 'GSP-22121': 'ready', 'GSP-22127': 'ready'}
for a in apps:
    if a['id'] in special:
        a['fin']['pay'] = special[a['id']]

# ---------- Finance terms for every catalogue university without a contract on file ----------
CAT_RATE = {i: float(r) for i, r in re.findall(r"\{ id: '([a-z-]+)',[^\n]*? rate: ([0-9.]+),", courses_ts)}
sample_terms = []
for u in CAT:
    if u['id'] in link:
        continue
    fid = 'C-' + u['id']
    r = CAT_RATE.get(u['id'], 15)
    sample_terms.append({'id': fid, 'name': u['name'], 'group': '', 'country': FCODE.get(u['country'], 'AU'), 'cur': {'Australia': 'AUD', 'UK': 'GBP', 'Canada': 'CAD', 'New Zealand': 'NZD', 'Ireland': 'EUR', 'USA': 'USD'}[u['country']],
                         'ends': '2027-12-31', 'trigger': 'census', 'inst': 1, 'payDays': 30, 'cap': None, 'levels': {'UG': r, 'PG': r, 'RES': r, 'DIP': r, 'FDN': r},
                         'fixed': {}, 'tier': None, 'flag': 'sample', 'status': 'Sample terms: no contract on file yet', 'sample': True,
                         'contract': {'rate': f'{r}% (the course record’s rate, until Finance adds the contract)'}})
    link[u['id']] = fid

# the catalogue's rate by level, from Finance's terms (PG rate as the course record's headline rate)
rates = {}
allterms = {f['id']: f for f in FUNIS + sample_terms}
for cid, fid in link.items():
    lv = allterms[fid].get('levels') or {}
    rates[cid] = {k: v for k, v in lv.items() if v not in (None, '')}

for r in rps.values():
    rp_details(r)

out = {
    'about': 'One application data set (Jovial, 31 Oct). Built by scripts/gen_dataset.py from the CRM-shaped work sample and Finance’s demo enrolments. Do not edit by hand.',
    'unis': list(added.values()),
    'link': link,
    'rates': rates,
    'sampleTerms': sample_terms,
    'rps': list(rps.values()),
    'students': students,
    'apps': apps,
    'idmap': idmap,
    'testAgency': TEST_OWN,
}
json.dump(out, open(f'{SRC}/data/dataset.json', 'w'), ensure_ascii=False, indent=1)
print(len(apps), 'apps;', len(students), 'students;', len(added), 'new universities;', len(sample_terms), 'sample terms;', sum(1 for r in rps.values() if not r['terms']), 'RPs without terms')
print('added:', [(u['id'], u['name'], u['fin']) for u in added.values()])
