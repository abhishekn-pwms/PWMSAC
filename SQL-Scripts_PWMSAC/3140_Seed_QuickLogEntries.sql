-- 3140_Seed_QuickLogEntries.sql

-- Seed data for quicklog_entries, migrated from the full Notepad
-- .LOG file on 2026-08-07 -- 118 historical entries, 2011-2024.
--
-- created_at is written with an explicit +05:30 (Asia/Kolkata)
-- offset -- the original file's timestamps were always local IST
-- clock time, not UTC. Without the explicit offset, Postgres was
-- storing these as if they were already UTC, making every one of
-- the 118 rows 5.5 hours later than it should be -- harmless for
-- ordering among these 118 rows relative to each other, but wrong
-- whenever compared against genuinely-UTC-correct new entries.
--
-- entry_text carries the same stamp, date-first (e.g.
-- '13-Jan-2012 17:47'), HTML-escaped -- 6 entries contain literal
-- <, >, or & characters that would otherwise be misread as tags.
--
-- created_by is set to 'Import' for all rows here.

insert into quicklog_entries (entry_text, created_at, created_by) values
('24-Jan-2011 01:48<br>Started Using.. 
-', '2011-01-24T01:48:00+05:30', 'Import'),
('18-Mar-2011 13:05<br>9820641550 - Suresh Ramani (+91 (22) 66776050)', '2011-03-18T13:05:00+05:30', 'Import'),
('29-Mar-2011 14:38<br>Uma Enterprise (WLAN Key): 80A1D72766B9', '2011-03-29T14:38:00+05:30', 'Import'),
('17-May-2011 13:12<br>IGS Malad Proxy - 
Address: 172.16.0.10
Port: 8080', '2011-05-17T13:12:00+05:30', 'Import'),
('18-May-2011 22:00<br>Rajendra Deshpande RD: +91-9820409109', '2011-05-18T22:00:00+05:30', 'Import'),
('25-May-2011 19:28<br>ADS Zainali Hussain: +91-9819011436', '2011-05-25T19:28:00+05:30', 'Import'),
('08-Aug-2011 13:03<br>Rahul VDI: +91-9930288156', '2011-08-08T13:03:00+05:30', 'Import'),
('29-Sep-2011 22:04<br>Sanjay Chandiramani: +91-9819911979 / +91 (22) 66776042', '2011-09-29T22:04:00+05:30', 'Import'),
('12-Oct-2011 14:07<br>IT Helpdesk: 1080 
IT Server Admin: 1105/6/8
Admin: 6012', '2011-10-12T14:07:00+05:30', 'Import'),
('12-Oct-2011 16:19<br>Ruchi Bhaskar (APRIA): +91-9999985575', '2011-10-12T16:19:00+05:30', 'Import'),
('12-Oct-2011 19:34<br>Reema Seth (NRE): +91-9819177660', '2011-10-12T19:34:00+05:30', 'Import'),
('13-Oct-2011 18:16<br>Pradeep Musham (IT): +91-9833444239', '2011-10-13T18:16:00+05:30', 'Import'),
('13-Jan-2012 17:47<br>GITRS#: LMP498', '2012-01-13T17:47:00+05:30', 'Import'),
('13-Jan-2012 17:53<br>SeBackupPrivilege, SeDebugPrivilege and SeLoadDriverPrivilege. Here is the example for the debug privileges: ntrights +r SeDebugPrivilege -u YourAccountName
ntrights +r SeDebugPrivilege -u abhishek_n
ntrights +r SeBackupPrivilege -u abhishek_n
ntrights +r SeLoadDriverPrivilege -u abhishek_n
ntrights +r SeTcbPrivilege -u abhishek_n
-- 
ntrights +r SeDebugPrivilege -u INTELENETGLOBAL\abhishek_n
ntrights +r SeBackupPrivilege -u INTELENETGLOBAL\abhishek_n
ntrights +r SeLoadDriverPrivilege -u INTELENETGLOBAL\abhishek_n
ntrights +r SeTcbPrivilege -u INTELENETGLOBAL\abhishek_n
-- 
ntrights +r SeDebugPrivilege -u Test_Ad
ntrights +r SeBackupPrivilege -u Test_Ad
ntrights +r SeLoadDriverPrivilege -u Test_Ad
ntrights +r SeTcbPrivilege -u Test_Ad

runas /noprofile /user:ABHISHEK-NB-IGS\Test_Ad "c:\Program Files\Unlocker\Unlocker.exe"', '2012-01-13T17:53:00+05:30', 'Import'),
('27-Jan-2012 16:21<br>SPR Navin Rathod (Dialer Manager): +91-9820143646', '2012-01-27T16:21:00+05:30', 'Import'),
('30-Jan-2012 13:45<br>Birla SunLife Call Center: 18002707000', '2012-01-30T13:45:00+05:30', 'Import'),
('01-Mar-2012 06:04<br>Venkatesh Palanisamy: +91-9884-119-871', '2012-03-01T06:04:00+05:30', 'Import'),
('09-Mar-2012 18:47<br>Vendor Contacts: 
-- 
NeoSoft, Yamini: +91-9619876527 (yamini.agre@neosofttech.com)
Flat Mind, Ravi: +91-8106677700 (ravi.d@flatmindtech.com)
Clover, Preeti: +91-9167058313 (preeti.gopalan@cloverinfotech.com)
Doyen, Mehul Jain: +91-9833585511 (mehulj@doyen.co.in) 
Velocis, Rama Sah: +91-9819278882 (rama.sah@velocis.in)
BSIL, Hitendra: +91-9867308086 (hitendra@bsil.com)
Value Momentum, Ritwik Bhowmik: +91-9833493434 (ritwik.bhowmik@valuemomentum.biz)
--', '2012-03-09T18:47:00+05:30', 'Import'),
('19-Apr-2012 18:57<br>Salesforce.com: 
Pooja: +91-9818-513-605 
Call Center Support # 0008000016000
-- 
International Dialing Details:
0011 &lt;International Code&gt; &lt;Number&gt; # 14410
US: 0 &lt;Number&gt;
UK: 8320
-- 
UK helpdesk 1091
--', '2012-04-19T18:57:00+05:30', 'Import'),
('19-Apr-2012 18:16<br>PSTN: 
Prakash - 6041 
Kumar - +91-9769177916', '2012-04-19T18:16:00+05:30', 'Import'),
('20-Apr-2012 12:01<br>Remote Team - Chintan (Malad): 6423 / 1081', '2012-04-20T12:01:00+05:30', 'Import'),
('31-Jul-2012 17:04<br>HR OPS: 5133
Aarti Shenoy: 6233
Viraj: 6208', '2012-07-31T17:04:00+05:30', 'Import'),
('14-Dec-2012 19:39<br>Sunil (Legal) - +91-11-66377025', '2012-12-14T19:39:00+05:30', 'Import'),
('14-Dec-2012 20:19<br>Intelenet72709*
sanjay_w
-- 
Intele72709net
Sanjay Welling
-- 
serco74182
RD: Serco@123
-- 
neha_g
Khatri@123', '2012-12-14T20:19:00+05:30', 'Import'),
('28-Dec-2012 12:41<br>support.questor@serco.com
Questor123', '2012-12-28T12:41:00+05:30', 'Import'),
('08-Jan-2013 16:44<br>Dipti: 6043', '2013-01-08T16:44:00+05:30', 'Import'),
('17-Jan-2013 19:19<br>https://igsmalutl01.intelenetglobal.com/pms/pms.nsf
https://10.200.52.20/pms/pms.nsf', '2013-01-17T19:19:00+05:30', 'Import'),
('07-May-2013 17:46<br>Manish (Vardhaman, Panache Lab-Trolley): +91-9920416612
Manisha (Vardhaman, Panache Lab-Trolley): +91-9594091556
Nikit (Vardhaman, Panache Lab-Trolley): +91-9324122011', '2013-05-07T17:46:00+05:30', 'Import'),
('16-May-2013 16:52<br>Devendra Sinha (Talisma CRM): +91-9867057326
devendras@talisma.com', '2013-05-16T16:52:00+05:30', 'Import'),
('16-May-2013 17:29<br>Devang (AMEAA Software Team): +91-9833739559
IT Helpdesk (Thane): 67856022
Riyaz: +91-9833552857
Suraj: +91-9820493282
Darpan / Kunal / Riyaz
Mahesh: +91-9172810133
IPLC: 11500
-- 

15:07 12/Jun/2013
IGS\DC719\2013

17:12 13/Jun/2013
Manish Rathi (IB Technology): +91-9958896174

15:11 30/Jul/2013
Barclays VCC/FAC:
Sakshi: 6332
Brian: 6335
Pooja: 6448
Dinesh Baria (WFM): +91-9819060768

12:32 12/Aug/2013
Sudalai Kumar (Bangalore): +91-8050475101
Karikalan P (Bangalore): +91-9945855305

13:28 12/Aug/2013
Murtaza Ghadiali: +971-559219095

16:10 22/Aug/2013
Bhavisha Dave: +91-9811904621

17:55 29/Aug/2013
http://eduunix.ccut.edu.cn/index2/database/Oracle/

15:47 03/Oct/2013
Shiraz: +91-22-66738395

13:48 04/Oct/2013
Kooh Website Designing: 
--- 
--- 
Live Pages Infotech Pvt Ltd
Devanshu / Nilambri: 
+91-22-67250786
+91-22-32494214
+91-22-28770067
-- 
-- 
Magnon Solutions Pvt. Ltd.
Krishna Jha (Sales)
Phone: +91-9833292927
+91-22-40101104
E-mail: krishna.jha@magnonsolutions.com
-- 

20:02 13/Nov/2013
Shailendra Chaturvedi (Server SME): 6059

18:50 14/Nov/2013
Sandeep Patil (Asset Team): +91-8082473769', '2013-05-16T17:29:00+05:30', 'Import'),
('26-Dec-2013 19:28<br>SM9 (Laptop configuration): 
Interaction SD1102378 has been added..', '2013-12-26T19:28:00+05:30', 'Import'),
('08-Jan-2014 18:31<br>Apex Honda (Kurla Workshop): 9870935422/31 (Chetan)', '2014-01-08T18:31:00+05:30', 'Import'),
('14-Feb-2014 17:03<br>drro-tccz-vlah-kyug
Manoj Jha: +91-9920550252', '2014-02-14T17:03:00+05:30', 'Import'),
('03-Mar-2014 14:45<br>MTNL (Yadav / Rajaram): +91-9969160727', '2014-03-03T14:45:00+05:30', 'Import'),
('10-Mar-2014 18:50<br>East-Coast: 
Hosted in Plymouth, UK', '2014-03-10T18:50:00+05:30', 'Import'),
('20-Mar-2014 16:12<br>Greetings team, 

We are looking for Contact Center CRM solutions across verticals, to be integrated with multiple Dialers.. 
Would appreciate if you could send us details about your products.. 

Thanks, 
Abhishek N', '2014-03-20T16:12:00+05:30', 'Import'),
('25-Mar-2014 13:22<br>Mohamed Nasser (Chennai SD): +91-9962188007
mohamed.nasser@intelenetglobal.com', '2014-03-25T13:22:00+05:30', 'Import'),
('04-Jul-2014 19:23<br>Vinayak C: 9223392236', '2014-07-04T19:23:00+05:30', 'Import'),
('21-Jul-2014 19:54<br>Girish: +91-9820489102 (AGM - CWFM)', '2014-07-21T19:54:00+05:30', 'Import'),
('18-Aug-2014 16:01<br>What is the name of your First School? riverbank
What is your Favourite Cuisine? babycorn
Which is your Place of Birth? kanpur
What is your Date of Birth? 19800930
What is your Pet''s Name? studious
User defined question 1: Who is?', '2014-08-18T16:01:00+05:30', 'Import'),
('09-Sep-2014 11:20<br>Jasleen Conference Moderator Code: 159 041 8145', '2014-09-09T11:20:00+05:30', 'Import'),
('10-Oct-2014 14:25<br>Manasi More: +91-9820909198', '2014-10-10T14:25:00+05:30', 'Import'),
('30-Oct-2014 18:45<br>http://d1cnp1wmwlnfo8.cloudfront.net/PDF2XL-Setup-Eval.msi', '2014-10-30T18:45:00+05:30', 'Import'),
('26-Nov-2014 15:37<br>Sammy: +91-9920801275', '2014-11-26T15:37:00+05:30', 'Import'),
('01-Dec-2014 16:53<br>Pratham: Lalit: +91-9829758577', '2014-12-01T16:53:00+05:30', 'Import'),
('01-Dec-2014 19:54<br>Vinayak: +91-9920088010', '2014-12-01T19:54:00+05:30', 'Import'),
('08-Dec-2014 14:37<br>Ajit Govind (TU): +91-9819090127', '2014-12-08T14:37:00+05:30', 'Import'),
('08-Dec-2014 17:02<br>Image Graphics (Kaushik)
3, Atul Apartment, Opposite Civil Hospital, Kamgar Chowk, Thane (West), Thane - 400602
022 2547 3435', '2014-12-08T17:02:00+05:30', 'Import'),
('07-Jan-2015 15:35<br>Procurement: 
Pranav Gupte: +91-9819918577
Mansi More: +91-9820909198', '2015-01-07T15:35:00+05:30', 'Import'),
('08-Jan-2015 18:53<br>Pradeep: +91-70-30403900', '2015-01-08T18:53:00+05:30', 'Import'),
('14-Jan-2015 20:54<br>That''s My Name - AKCEN
I Won''t Give Up On Us - Jason Mraz', '2015-01-14T20:54:00+05:30', 'Import'),
('10-Feb-2015 15:18<br>Rakesh Jain: +91-9663585256', '2015-02-10T15:18:00+05:30', 'Import'),
('08-Mar-2015 13:53<br>Airtel Dongle: 18001030405 (1/3)', '2015-03-08T13:53:00+05:30', 'Import'),
('23-Mar-2015 15:02<br>Sachin Pol (Sparsh Engg): +91-9594942294', '2015-03-23T15:02:00+05:30', 'Import'),
('15-May-2015 18:42<br>Amazon Hosting: Windows Server 2012 R2
Java Struts: 1.2
Hibernate: 4.0
MySQL: 5.5
Eclipse for Development

Expenzing: version 9.2
Development Center: Mumbai
Development Support: 8-10 people
Core Support: Business hours
Uptime: 24x7 from Amazon EC2
Functional Support: Business hours
Eclipse for Development', '2015-05-15T18:42:00+05:30', 'Import'),
('02-Jun-2015 19:10<br>Vikrant (Engg.): +91-9821176875
L0(@L$AdmiN!', '2015-06-02T19:10:00+05:30', 'Import'),
('04-Jun-2015 17:54<br>[Bridge Details Charged] Chargeable bridge:
Details:

International dial-in number:
+91 2233437001

Conference code: 
8899044962
Leader PIN: 
3473', '2015-06-04T17:54:00+05:30', 'Import'),
('08-Jun-2015 16:28<br>Sachin Taori: +91-9167113701', '2015-06-08T16:28:00+05:30', 'Import'),
('21-Sep-2015 13:23<br>Network Name (SSID): VodafoneMobile Wifi_8915B2
EA88HKJP5N', '2015-09-21T13:23:00+05:30', 'Import'),
('12-Nov-2015 16:10<br>IGS Pankaj Rane: +91-8451909505', '2015-11-12T16:10:00+05:30', 'Import'),
('24-Dec-2015 13:59<br>I have an Ola coupon worth ?100 for you. Sign up with my code 77GCVR to avail the coupon and ride for free. Have a great ride! Download: http://m.ola.bz/sx2ars
-
Want a free Uber ride? Use my code nitashab16ue to get your first one free, up to ?250. Redeem it at: https://www.uber.com/invite/nitashab16ue', '2015-12-24T13:59:00+05:30', 'Import'),
('07-Jan-2016 15:28<br>100149843', '2016-01-07T15:28:00+05:30', 'Import'),
('28-Jan-2016 14:55<br>Shaheen K: +91-9820966024', '2016-01-28T14:55:00+05:30', 'Import'),
('10-Feb-2016 18:33<br>Harshal Ambani: +91-9320588411
Hitesh Behal: +91-9810332684', '2016-02-10T18:33:00+05:30', 'Import'),
('15-Feb-2016 14:42<br>GMail - Your app password for Windows Computer: lazz-eyvl-hxzr-lzcu', '2016-02-15T14:42:00+05:30', 'Import'),
('29-Feb-2016 12:28<br>In what town or city did your mother and father meet? bareily
place of birthh? kanpur
Who are you? studious', '2016-02-29T12:28:00+05:30', 'Import'),
('29-Feb-2016 16:34<br>+91-22-23016101 (Safety)', '2016-02-29T16:34:00+05:30', 'Import'),
('07-Jun-2016 18:39<br>Deepak: +91-9892049055', '2016-06-07T18:39:00+05:30', 'Import'),
('21-Jun-2016 20:13<br>Veena Dsouza (Barclays Investigations): +91-8879100552', '2016-06-21T20:13:00+05:30', 'Import'),
('14-Jul-2016 13:00<br>Reliance: Form 16.1 &amp; undetaking', '2016-07-14T13:00:00+05:30', 'Import'),
('18-Jul-2016 13:13<br>https://www.fhpl.net/
Corporate ID: 1340
User Name: II0006856
Password: A856', '2016-07-18T13:13:00+05:30', 'Import'),
('27-Jul-2016 16:35<br>+91-22-66735787', '2016-07-27T16:35:00+05:30', 'Import'),
('10-Aug-2016 14:05<br>Network Name (SSID) * Go-NoGo-Go-NoGo  

Broadcast Network Name (SSID) Disable  
Security Mode WPA2(AES)-PSK
Pass Phrase * Aman@54321

Band Selection 2.4GHz
Network Mode 802.11 b/g/n
Channel Bandwidth 20MHz
Country/Region Code INDIA
Frequency (Channel) Auto', '2016-08-10T14:05:00+05:30', 'Import'),
('12-Aug-2016 13:38<br>Complaint Number: 1129010
Car-holder dispute form.', '2016-08-12T13:38:00+05:30', 'Import'),
('17-Aug-2016 15:00<br>Way No. PRO4049395
Ref./Folio No: 
Origin: Mumbai-Kurla
Destination: Ludhiana
DRS No DLDH880008826

prokurla@tpcmumbai.in

Was suggested to use ProPremium service to ensure quick delivery. However, even after 4 working days, the consignment is still un-delivered.

Our Concerned Person will reach you shortly.
Please use the Customer ID  CRM138036 for further reference regarding the complaint.', '2016-08-17T15:00:00+05:30', 'Import'),
('08-Sep-2016 13:02<br>Kamadhenu:
Kiran Kowlgi: +91-9811857533
kiran.kowlgi@kamadhenu.co.in', '2016-09-08T13:02:00+05:30', 'Import'),
('12-Sep-2016 15:52<br>\\IGSWRPRNSRV\IGSTHNTECPRN01
10.200.132.41', '2016-09-12T15:52:00+05:30', 'Import'),
('28-Sep-2016 15:31<br>HP Service Manager Request:
Interaction SD2783949: McAfee Antivirus &amp; AntiSpyware not updating on LAN', '2016-09-28T15:31:00+05:30', 'Import'),
('29-Sep-2016 18:21<br>WLAN Name(SSID): AN-TD-EC315-40DD
802.11 authentication: WPA/WPA2-PSK
Encryption mode: AES+TKIP
WPA pre-shared key: 1957093018
--
System Access
User Name: admin
Password: Meher2203
--
OTASP activation
Postpaid
PIN: 1957093019800918
--', '2016-09-29T18:21:00+05:30', 'Import'),
('14-Oct-2016 18:16<br>https://intelenet-my.sharepoint.com/personal/abhishek_nandrajog_intelenetglobal_com/Documents/Email-Queue-Management_AAC', '2016-10-14T18:16:00+05:30', 'Import'),
('24-Oct-2016 16:55<br>Case ID: RX32503241016999', '2016-10-24T16:55:00+05:30', 'Import'),
('24-Oct-2016 17:05<br>Srini: +91-22-66776066', '2016-10-24T17:05:00+05:30', 'Import'),
('28-Oct-2016 16:03<br>Interaction SD2833972 has been added.', '2016-10-28T16:03:00+05:30', 'Import'),
('24-Nov-2016 15:36<br>HDFC Life
User ID: 11562694
Pwd: Asdf@0987

Policy Number: 18716156
D.O.B.: 18/09/1980

Secret Q: What is your pet''s name?
Secret A: studious
Secret Q: What is your city of birth?
Secret A: kanpur', '2016-11-24T15:36:00+05:30', 'Import'),
('27-Dec-2016 16:32<br>Printers/Scanners:
Thane:
HP LaserJet Pro MFP M127-M128 PCLmS
IGSTHNTECPRN01 on IGSWRPRNSRV
--
Malad:
IGSMALLEPRN02 on IGSWRPRNSRV (10.201.159.30)', '2016-12-27T16:32:00+05:30', 'Import'),
('12-Jan-2017 15:54<br>Godrej MRD: +91-22-66417049', '2017-01-12T15:54:00+05:30', 'Import'),
('13-Jan-2017 12:20<br>BIRTH CERTIFICATE
MEHER / ????
REGISTRATION NUMBER: B-2016: 27-90274-001826', '2017-01-13T12:20:00+05:30', 'Import'),
('16-Jan-2017 14:15<br>Panasonic Washing Machine
Model #: NA-F65B2 ECO AQUABEAT 6.5Kgs', '2017-01-16T14:15:00+05:30', 'Import'),
('30-Jan-2017 13:20<br>Samsung Service
Vijay: +919819313051', '2017-01-30T13:20:00+05:30', 'Import'),
('30-Jan-2017 16:54<br>Bajaj Allianz
INR 7483/-', '2017-01-30T16:54:00+05:30', 'Import'),
('02-Feb-2017 15:57<br>wtaj-urir-cvbi-rhlx

qavz-vfit-kduk-prno', '2017-02-02T15:57:00+05:30', 'Import'),
('27-Feb-2017 14:23<br>ICIC Merchant Services
Case ID: 2014254693', '2017-02-27T14:23:00+05:30', 'Import'),
('28-Feb-2017 18:11<br>HDFC Bank
Reach your Relationship Manager when you need. Name: ASMINA SAI, Email ID: Asmina.Sai@Hdfcbank.Com, Mobile No.: 2261906517.', '2017-02-28T18:11:00+05:30', 'Import'),
('06-Mar-2017 18:58<br>Payseal IMS: +91-22-41634247 (Anju Behwal)', '2017-03-06T18:58:00+05:30', 'Import'),
('08-Mar-2017 12:57<br>ICIC Merchant Services
Case ID: 2014288131

+91-9619034322 (Jayant)', '2017-03-08T12:57:00+05:30', 'Import'),
('31-May-2017 13:17<br>https://www.slideshare.net/menameissa/business-requirements-gathering-and-analysis', '2017-05-31T13:17:00+05:30', 'Import'),
('13-Jun-2017 16:29<br>HDFC Life: (WhatsApp) +91-9920094198
Policy #: 1200042405837', '2017-06-13T16:29:00+05:30', 'Import'),
('18-Dec-2017 13:54<br>IT Helpdesk:
Parth: +91-7045832456
for Amol', '2017-12-18T13:54:00+05:30', 'Import'),
('19-Jan-2018 17:14<br>roshan.vichare@hdfcbank.com', '2018-01-19T17:14:00+05:30', 'Import'),
('19-Feb-2018 14:09<br>---
---
Y! &gt;&gt; bvgz mbtn wlfr rped

Otlk &gt;&gt; hbhc oabg opgm denp
---
---', '2018-02-19T14:09:00+05:30', 'Import'),
('30-Mar-2021 19:33<br>Janakalyan: +91-22-25235467', '2021-03-30T19:33:00+05:30', 'Import'),
('23-Mar-2023 12:27<br>.\srtdskcap
.\mahasupport
Inf0rm@tion@0909
(Prev: Password@123456)', '2023-03-23T12:27:00+05:30', 'Import'),
('04-Apr-2023 18:16<br>Startek Connect Secure
https://srtinnpsgw.startek.com/

Ivanti Secure Access Client VPN
username: abhishek.nandrajog
pswd: &lt;current domain pswd&gt;

Startek SAP
User ID : IN80507527
Initial Password : Kurla@mumbai*0625

--
Backup Codes: LSZBSQ,BTJFVM,CWZ7D5,KGZJME,ZXMCEK,2X7ZC3,GV2VED,DGY63C,N3PB6N,MSFRNB', '2023-04-04T18:16:00+05:30', 'Import'),
('24-May-2023 17:55<br>Since Canon is not sharing the details of their email addresses to be configured on LISA tool, they will need to auto-forward emails to these new Startek addresses. However, while replying back to customer, we will use Canon address only. Hope that clarifies.', '2023-05-24T17:55:00+05:30', 'Import'),
('31-May-2023 18:01<br>2821/27072/02957
--
28212707202957', '2023-05-31T18:01:00+05:30', 'Import'),
('05-Jun-2023 18:44<br>Praneeth: 040-67691403', '2023-06-05T18:44:00+05:30', 'Import'),
('24-Jul-2023 11:34<br>Meet Ashley (refer Chetan Mhabdi)', '2023-07-24T11:34:00+05:30', 'Import'),
('27-Jul-2023 15:45<br>Bimal Uncle Mehta: +91 9324564442', '2023-07-27T15:45:00+05:30', 'Import'),
('02-Aug-2023 16:16<br>Premium Care Lenovo Helpline: 1800 121 9339', '2023-08-02T16:16:00+05:30', 'Import'),
('18-Sep-2023 23:52<br>Thank you for your email. I am on leave and will resume on 2-Aug.
For any urgent concerns, please send an email to DigitalSolutions@startek.com.', '2023-09-18T23:52:00+05:30', 'Import'),
('30-Apr-2024 14:46<br>received:01-01-2023..30-04-2023', '2024-04-30T14:46:00+05:30', 'Import'),
('02-May-2024 17:35<br>Voucher Code: FKEXYAVeED2Wz6h', '2024-05-02T17:35:00+05:30', 'Import'),
('26-Jul-2024 09:36<br>---
MS Azure Security:
 * https://azure.microsoft.com/en-in/explore/trusted-cloud/privacy
 * https://learn.microsoft.com/en-IN/azure/compliance/
---
Amazon AWS Security:
 * https://aws.amazon.com/compliance/programs/
 * https://aws.amazon.com/compliance/data-protection/', '2024-07-26T09:36:00+05:30', 'Import'),
('03-Dec-2024 15:04<br>High-level demo showcase points
* Walkthrough of Samespace
* Campaigns
* Blast messages (SMS with links to be demonstrated during meeting)
* Reports &amp; Analytics
* Outbound IVR (use case e.g. Switch &amp; Earn)', '2024-12-03T15:04:00+05:30', 'Import'),
('12-Dec-2024 11:54<br>Mountain Go: +852 98891980', '2024-12-12T11:54:00+05:30', 'Import'),
('30-Oct-2025 20:43<br>IN80507527
80507527afipn0664c', '2025-10-30T20:43:00+05:30', 'Import'),
('07-Aug-2026 18:53<br>Questions for in-house tools:

===========================

Pulse AutoQA
1. Just to understand the deployment model, how does Pulse AutoQA receive customer interactions? Are there any dependencies on the customer''s recording, transcription or contact centre platform that we should be aware of?

===========================

AgentAssist
1. How does AgentAssist work across both CCaaS and non-CCaaS environments? Are there any dependencies on the underlying telephony/contact centre platform?

2. Does it automatically determine when a customer interaction starts and ends? Does it automatically create a unique interaction/session record for each call?

3. In scenarios where there is no direct telephony integration, what metadata is used to identify and track customer interactions (eg. agent workstation, application session, browser session, etc.)?

4. How does it handle call lifecycle scenarios such as hold/resume, transfers, conference calls and payment gateway/PCI interception scenarios?

5. How does the platform maintain transcript continuity, sentiment tracking and summarization when an interaction moves across different call stages or participants?

===========================', '2026-08-07T18:53:00+05:30', 'Import'),
('07-Aug-2026 18:54<br>Write-up on Startek CCI Merger

With the merger of Startek and CCI, we now have an extensive portfolio of digital solutions and AI technologies, many of which are proprietary, in-house platforms built specifically to address the challenges faced in our operations. These solutions are designed to help improve productivity, enhance customer experience, reduce costs, and deliver better business outcomes for our clients.
We encourage each of you to reflect on your respective programs and identify opportunities where these capabilities can create tangible value. You have strong relationships with your clients and a deep understanding of their business challenges. We rely on you to champion these solutions, initiate meaningful conversations, and position them as strategic enablers that help our clients achieve better outcomes while strengthening our partnership.
Together, let''s unlock the full potential of our combined capabilities and continue raising the bar on delivery excellence.

===========================', '2026-08-07T18:54:00+05:30', 'Import');