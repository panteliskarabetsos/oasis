--
-- PostgreSQL database dump
--

\restrict 5ZE4Jr4bm79ni6fEFxNOIK235TfwrgWJPgNKSkjLzaihHIJ7ULKdjRhNRfoCPk3

-- Dumped from database version 16.8 (Debian 16.8-1.pgdg120+1)
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."User" (id, email, password, name, surname, phone, "dateOfBirth", "createdAt", "updatedAt", role, "passwordChangeHistory") FROM stdin;
2	kokkinakistavroula15@gmail.com	$2b$10$qTHFlXvF4nno75Qja8LAFeTiAiSu7zG29rjEl9nnXR0jB1qd889fS	Stavroula	Kokkinaki	6971729134	2002-09-16 03:00:00	2025-04-16 01:04:04	2025-04-16 01:04:04	admin	\N
6	marianthikarabb@icloud.com	$2b$10$JY.fXnLC/G55.jShG.F12u2akEmQRaG2sEF2GiUKSRAXN..3oO.da	Marianthi	Karabetsou	6988506337	2007-02-13 00:00:00	2025-04-20 14:41:28.314	2025-04-20 14:41:28.314	user	\N
7	mzisis01@gmail.com	$2b$10$dErPlIprY57Asm4Y/orJAO12q/LCVawdzrIRfwuWEECNyt/QvfJ5u	Marios	Zisis	6908364804	2001-05-08 00:00:00	2025-04-21 15:12:19.424	2025-04-29 13:48:11.193	user	\N
3	contact@pkarabetsos.com	$2b$10$4L1mzwQ09sEX3ykh/U/Q9OJ9Ih.9LbVFXJ/TPepz.Dpsk..GGR3SS	Pantelis	Karabetsos	6944444422	2002-03-21 00:00:00	2025-04-16 16:51:59	2025-08-31 16:39:39.26	admin	["2025-08-31T16:39:10.662Z", "2025-08-31T16:39:39.072Z"]
\.


--
-- Data for Name: Account; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Account" (id, "userId", provider, "providerAccountId") FROM stdin;
\.


--
-- Data for Name: Experience; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Experience" (id, name, description, price, location, "whatsIncluded", "whatToBring", "whyYoullLove", duration, "mapPin", "guestReviews", "createdAt", "updatedAt", visibility, frequency, images, slug) FROM stdin;
10	Cooking with Yiayia	Step into a real Cretan home and cook with local grandmothers — the heart and soul of tradition. Learn to roll phyllo by hand, make seasonal pies, and discover the secrets of folk rituals like xematiasma (the blessing against the evil eye).\n\nThis is more than cooking. It’s stories, connection, and a warm meal shared like family.\n	140	Voukolies, Chania	Arrive at a warm village home or courtyard where Yiayia welcomes us\nLearn how to prepare traditional dough and roll your own phyllo\nCreate Cretan pites using seasonal ingredients (like wild greens, herbs, or cheese)\nWhile they cook, gather for stories, raki, and a taste of folk magic\nWitness a gentle “evil eye ritual” — a prayer-blessing done the old way\nEnjoy a cozy homemade meal together, just like Sunday lunch with family	comfortable clothes	1.\tReal interaction with local grandmothers (no actors!)\n\n2.\tA rare peek into unwritten folk wisdom still alive in the villages\n\n3.\tNot just food — it’s connection, healing, and a warm human hug	4 Hours		["It was very nice!"]	2025-04-16 15:16:46.968	2025-09-05 12:32:16.491	t	{Friday,Saturday}	{https://res.cloudinary.com/docgxigth/image/upload/v1744818706/village-2_vzsiho.jpg,https://res.cloudinary.com/docgxigth/image/upload/v1744818707/village-3_umj5bq.jpg,https://res.cloudinary.com/docgxigth/image/upload/v1744818742/village-1_wn3cq6.jpg}	cooking-with-yiayia
14	WHISPERS OF HERBS	Slow down. Smell the thyme. Craft a memory.\n\nStep into the peaceful heart of Crete on a gentle walk through Theriso Gorge, just 20 minutes from Chania. Guided by the scents of thyme, sage, and mountain tea, you’ll learn about local herbs and their place in Cretan life.\n\nWe’ll pause under the trees for a wild herbal tea moment, and then — using the herbs we’ve gathered — we’ll create together homemade herbal pouches, a small keepsake of your time in nature.\n\n	220	Therissos, Chania	\tMindful 1.5–2km walk through nature\n\tIdentify and gently gather wild herbs\n\tLearn their traditional uses in healing and cooking\nPause in the shade for a moment of calm and enjoy a freshly brewed herbal tea\nCreate your own herbal pouch to take home — hand-blended and full of scent\nShort forest meditation\n	Comfortable Clothes\nWater	1.\tAuthentic & Local: Learn from real Cretan olive growers.\n2.\tImmersive & Relaxing: A mindful activity close to nature.\n3.\tTastes & Scents of Crete: Enjoy flavors passed down through generations.\n4.\tEco-conscious Travel: Support sustainable agritourism & traditional practices.\n	7 Hours	35.4038698, 23.9853983	[""]	2025-04-16 17:27:20.137	2025-04-26 20:55:34.389	t	{Tuesday,Friday,Saturday}	{https://res.cloudinary.com/docgxigth/image/upload/v1744824427/mountain-welness_kgkwc8.jpg}	whispers-of-herbs
15	Olive harvest: A True Hands-on Tradition	Step into the rhythm of the land. Join us in the olive grove.\n\nIn a world that moves too fast, the olive harvest invites you to slow down. To feel the soil beneath your feet, the sun on your back, and the history in your hands. No machines. No staged shows. Just people, trees, and time — the way our grandparents did it.\n	120	Kouloukouthiana 	 Walk together to the olive grove and learn the story of the land\n Spread the cloths beneath the trees\n Harvest olives by hand or using small wooden sticks\n Gather around for a shared break — with fresh bread, olives, local cheese & wine\n Listen to stories from the old days, and maybe share a few of your own\n Feel like part of a family, not a tourist group\n	• Comfortable clothes (you might get a bit dusty — that’s the fun!)\n• Closed shoes suitable for walking in the field\n• A sense of curiosity and a willingness to get your hands involved\n	• Because it’s real — no filters, no crowds, no noise.\n• You’ll be part of an age-old tradition, not just an observer.\n• It connects you with nature, people, and the roots of food itself.\n• It’s meaningful, grounding, and unexpectedly joyful.\n	5 Hours	35.481301,23.803877	[""]	2025-04-18 10:32:18.282	2025-06-22 09:14:36.563	t	{Tuesday,Friday,Saturday}	{https://res.cloudinary.com/docgxigth/image/upload/v1744972316/image_processing20180605-4-a8ztbs_yeyvmp.jpg,https://res.cloudinary.com/docgxigth/image/upload/v1744972324/%CE%A3%CF%85%CE%B3%CE%BA%CE%BF%CE%BC%CE%B9%CE%B4%CE%AE-%CE%95%CE%BB%CE%B9%CE%AC%CF%82.jpg_dgdqc6.webp,https://res.cloudinary.com/docgxigth/image/upload/v1744972331/65_tugff4.jpg}	olive-harvest-a-true-hands-on-tradition
17	Cretan Harmony – Wellness & Tradition	Immerse yourself in a full-day journey of wellness and tradition in the heart of Crete. From a calming morning yoga session among olive groves, to cooking with fresh local ingredients, to sound healing as the sun sets, this experience blends nature, gastronomy, culture, and mindfulness into one unforgettable ritual. It’s a day designed to nourish your body, mind, and soul while connecting you with the authentic spirit of Crete.	160	Therissos	Welcome drinks with traditional Cretan herbal teas\nMorning yoga / mindful stretching in a natural setting\nGuided nature walk and herb gathering with a local host\nCooking class with traditional, healthy Cretan dishes\nLunch with wine & olive oil tasting\nCreative workshop (pottery or natural cosmetics)\nSound healing & guided relaxation\nSunset closing ritual with panoramic views\nSmall keepsake gift (handmade ceramic or local herbs)	Comfortable clothes for yoga and walking\n\nHat, sunglasses, and sunscreen\n\nSmall backpack\n\nAn open heart and willingness to relax 🌿	Because it’s not just an activity – it’s a wellness journey.\n\nYou’ll experience authentic Cretan hospitality, not as a tourist but as a friend.\n\nYou’ll engage all your senses: taste, smell, touch, sound, and creativity.\n\nYou’ll learn practical secrets of the Cretan diet and longevity.\n\nYou’ll leave feeling renewed, energized, and carrying a true piece of Crete within you.	8 hours		[""]	2025-09-10 09:51:45.289	2025-09-10 09:52:55.831	t	{Friday,Sunday}	{https://res.cloudinary.com/docgxigth/image/upload/v1757497902/AdobeStock_1316718622_pfqre9.jpg}	cretan-harmony-wellness-and-tradition
18	Myth of Crete	Step into a living myth of Crete – where wellness, tradition, and storytelling meet. In this immersive full-day journey, you’ll begin your morning with yoga among olive trees inspired by the myth of Zeus, gather herbs in “Ariadne’s Garden,” cook and share a meal fit for King Minos, and create your own keepsake in the spirit of Daedalus. The day closes with sound healing in the “Labyrinth of Echoes” and a sunset ritual that connects you to the eternal flame of Crete. This is not just an activity – it’s a soulful ritual that brings myths to life through movement, taste, creativity, and mindfulness.	140	Apokoronas, Chania	Welcome herbal drink on arrival\nMorning yoga & meditation among olive groves\nGuided nature walk and herb gathering with mythological storytelling\nCooking class with traditional Cretan dishes & Mediterranean diet insights\nShared lunch with wine and olive oil tasting\nCreative workshop (pottery or natural cosmetics)\nSound healing & guided relaxation with traditional and modern instruments\nSunset closing ritual with panoramic views\nA small keepsake gift (olive oil vial, handmade ceramic, or herbs)	omfortable clothing for yoga and walking\n\nHat, sunglasses, sunscreen\n\nSmall backpack\n\nCuriosity and an open heart 🌿	You’ll live inside the myths of Crete, not just hear about them.\n\nYou’ll experience wellness and tradition blended into one soulful journey.\n\nYou’ll engage all your senses: movement, flavors, scents, sounds, and creativity.\n\nYou’ll discover the secrets of Cretan longevity and mindful living.\n\nYou’ll leave feeling renewed, with your own handmade keepsake and a story to carry forever.	7 Hours		[""]	2025-09-10 10:03:47.51	2025-09-10 10:03:47.51	t	{Saturday}	{https://res.cloudinary.com/docgxigth/image/upload/v1757498625/Screenshot_2025-09-10_at_1.03.38_PM_hyoidh.png}	myth-of-crete
\.


--
-- Data for Name: ScheduleSlot; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ScheduleSlot" (id, "experienceId", date, "totalSlots", "bookedSlots", "createdAt", "updatedAt", "isCancelled") FROM stdin;
46	15	2025-07-26 07:00:00	8	0	2025-04-29 13:44:41.075	2025-04-29 13:44:41.075	f
48	10	2025-07-26 08:00:00	8	0	2025-06-13 23:35:04.658	2025-06-13 23:35:04.658	f
49	14	2025-08-23 08:30:00	6	0	2025-06-13 23:35:24.879	2025-06-13 23:35:24.879	f
50	15	2025-07-26 05:15:00	9	1	2025-06-13 23:35:49.674	2025-07-14 18:46:11.511	f
51	10	2025-08-30 06:30:00	8	0	2025-08-13 09:42:44.88	2025-08-13 09:42:44.88	f
53	14	2025-08-30 05:00:00	9	0	2025-08-13 09:43:50.303	2025-08-13 09:43:50.303	f
54	15	2025-08-30 08:00:00	9	0	2025-08-13 09:44:12.709	2025-08-13 09:44:12.709	f
52	14	2025-08-30 05:00:00	9	1	2025-08-13 09:43:50.299	2025-08-13 09:46:52.765	f
55	10	2025-10-03 07:00:00	8	0	2025-08-31 16:48:06.42	2025-08-31 16:48:06.42	f
\.


--
-- Data for Name: Booking; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Booking" (id, "userId", "createdAt", "scheduleSlotId", status, "updatedAt", notes, "numberOfPeople") FROM stdin;
83	3	2025-07-14 18:46:08.925	50	confirmed	2025-07-14 18:46:08.925		1
84	3	2025-08-13 09:46:50.205	52	confirmed	2025-08-13 09:46:50.205		1
\.


--
-- Data for Name: Favourite; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Favourite" (id, "userId", "experienceId") FROM stdin;
\.


--
-- Data for Name: PasswordResetToken; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PasswordResetToken" (id, token, "userId", "expiresAt", "createdAt") FROM stdin;
4	d8194afacd5763a4b22c6c1b93acd8bc8a86fddda46aecd581730782ebe1f434	2	2025-04-22 22:33:57.871	2025-04-22 21:33:57.873
11	2e7c67cbdedd8d01b8dbb5885b45b7b4278fb49b56fb8ecd75cddc042c4f0790	3	2025-04-27 12:13:58.303	2025-04-27 11:13:58.304
\.


--
-- Data for Name: Session; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Session" (id, "userId", "sessionToken", expires) FROM stdin;
\.


--
-- Name: Account_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Account_id_seq"', 1, false);


--
-- Name: Booking_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Booking_id_seq"', 84, true);


--
-- Name: Experience_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Experience_id_seq"', 18, true);


--
-- Name: Favourite_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Favourite_id_seq"', 1, false);


--
-- Name: PasswordResetToken_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."PasswordResetToken_id_seq"', 12, true);


--
-- Name: ScheduleSlot_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."ScheduleSlot_id_seq"', 55, true);


--
-- Name: Session_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Session_id_seq"', 1, false);


--
-- Name: User_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."User_id_seq"', 23, true);


--
-- PostgreSQL database dump complete
--

\unrestrict 5ZE4Jr4bm79ni6fEFxNOIK235TfwrgWJPgNKSkjLzaihHIJ7ULKdjRhNRfoCPk3

