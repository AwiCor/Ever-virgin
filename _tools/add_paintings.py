#!/usr/bin/env python3
"""Inject additional classical paintings into data/mysteries.json.

Each mystery is expanded to at least 10 paintings, drawing from da Vinci,
Michelangelo, Raphael, Caravaggio, Rubens, Murillo, Bouguereau, Tanner,
Dali, Chagall, and other masters across periods. URLs use the Wikimedia
Commons Special:FilePath redirect, which is stable as long as the file
name on Commons does not change. The renderer already has a fallback
chain that swaps to other paintings if an image fails to load.
"""
import json
import os
import sys
from collections import OrderedDict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(ROOT, "data", "mysteries.json")


def commons(filename):
    """Wikimedia Commons stable redirect to the file's full image."""
    return f"https://commons.wikimedia.org/wiki/Special:FilePath/{filename}?width=1280"


# Additions keyed by mystery id. Each item is (artist, title, commons_filename).
ADDITIONS = {
    "joyful_1": [
        ("Leonardo da Vinci", "The Annunciation (c. 1472)",
         "Leonardo_da_Vinci_-_Annunciazione_-_Google_Art_Project.jpg"),
        ("Jan van Eyck", "The Annunciation",
         "Jan_van_Eyck_-_The_Annunciation_-_Google_Art_Project.jpg"),
        ("Bartolomé Esteban Murillo", "The Annunciation",
         "Bartolomé_Esteban_Murillo_-_The_Annunciation.jpg"),
        ("Henry Ossawa Tanner", "The Annunciation (1898)",
         "Henry_Ossawa_Tanner_-_The_Annunciation.jpg"),
        ("Dante Gabriel Rossetti", "Ecce Ancilla Domini (1850)",
         "Dante_Gabriel_Rossetti_-_Ecce_Ancilla_Domini!_-_Google_Art_Project.jpg"),
    ],
    "joyful_2": [
        ("Domenico Ghirlandaio", "The Visitation",
         "Domenico_Ghirlandaio_-_Visitation_-_WGA08768.jpg"),
        ("Mariotto Albertinelli", "The Visitation",
         "Mariotto_Albertinelli_-_Visitation_-_WGA00399.jpg"),
        ("Federico Barocci", "The Visitation",
         "Federico_Barocci_-_Visitation_-_WGA01480.jpg"),
        ("Carl Heinrich Bloch", "The Visitation",
         "Carl_Heinrich_Bloch_-_The_Visitation.jpg"),
    ],
    "joyful_3": [
        ("Hugo van der Goes", "Portinari Altarpiece (Adoration of the Shepherds)",
         "Hugo_van_der_Goes_004.jpg"),
        ("Gerard van Honthorst", "Adoration of the Shepherds",
         "Gerrit_van_Honthorst_-_Adoration_of_the_Shepherds_-_WGA11653.jpg"),
        ("William-Adolphe Bouguereau", "Song of the Angels (1881)",
         "William-Adolphe_Bouguereau_(1825-1905)_-_Song_of_the_Angels_(1881).jpg"),
        ("Albrecht Dürer", "Nativity (Paumgartner Altarpiece, c. 1500)",
         "Albrecht_Dürer_-_The_Paumgartner_Altarpiece_-_WGA07084.jpg"),
        ("Edward Burne-Jones", "The Star of Bethlehem (1890)",
         "Edward_Burne-Jones_-_The_Star_of_Bethlehem_-_Google_Art_Project.jpg"),
    ],
    "joyful_4": [
        ("Hans Memling", "Presentation in the Temple",
         "Hans_Memling_-_The_Presentation_in_the_Temple_-_WGA15013.jpg"),
        ("Vittore Carpaccio", "Presentation of Jesus at the Temple",
         "Vittore_Carpaccio_-_Presentation_of_Jesus_at_the_Temple_-_WGA04576.jpg"),
        ("Lorenzo Lotto", "Presentation in the Temple",
         "Lorenzo_Lotto_-_Presentation_in_the_Temple_-_WGA13632.jpg"),
        ("Giovanni Battista Tiepolo", "Presentation in the Temple",
         "Giovanni_Battista_Tiepolo_-_Presentation_in_the_Temple_-_WGA22344.jpg"),
    ],
    "joyful_5": [
        ("Albrecht Dürer", "Christ Among the Doctors",
         "Albrecht_Dürer_-_Jesus_among_the_Doctors_-_WGA07054.jpg"),
        ("William Holman Hunt", "The Finding of the Saviour in the Temple",
         "William_Holman_Hunt_-_The_Finding_of_the_Saviour_in_the_Temple_-_Google_Art_Project.jpg"),
        ("Heinrich Hofmann", "Christ in the Temple (1881)",
         "Heinrich_Hofmann_-_Christ_in_the_Temple.jpg"),
        ("Max Liebermann", "The Twelve-Year-Old Jesus in the Temple",
         "Max_Liebermann_-_Der_zwölfjährige_Jesus_im_Tempel_-_Google_Art_Project.jpg"),
        ("Cima da Conegliano", "Christ Among the Doctors",
         "Cima_da_Conegliano_-_Christ_among_the_Doctors_-_WGA04902.jpg"),
        ("James Tissot", "The Young Jesus Disputing with the Doctors",
         "Brooklyn_Museum_-_Jesus_with_the_Doctors_(Jésus_au_milieu_des_docteurs)_-_James_Tissot.jpg"),
    ],
    "luminous_1": [
        ("Bartolomé Esteban Murillo", "The Baptism of Christ",
         "Bartolomé_Esteban_Murillo_-_The_Baptism_of_Christ_-_WGA16407.jpg"),
        ("Joachim Patinir", "The Baptism of Christ",
         "Joachim_Patinir_-_The_Baptism_of_Christ_-_WGA17098.jpg"),
        ("Domenico Ghirlandaio", "Baptism of Christ",
         "Domenico_Ghirlandaio_-_Baptism_of_Christ_-_WGA08785.jpg"),
        ("Aert de Gelder", "The Baptism of Christ",
         "Aert_de_Gelder_-_The_Baptism_of_Christ_-_WGA08530.jpg"),
        ("James Tissot", "The Baptism of Jesus",
         "Brooklyn_Museum_-_The_Baptism_of_Jesus_(Baptême_de_Jésus)_-_James_Tissot.jpg"),
    ],
    "luminous_2": [
        ("Duccio di Buoninsegna", "Marriage at Cana",
         "Duccio_di_Buoninsegna_-_Wedding_at_Cana_-_WGA06727.jpg"),
        ("Mattia Preti", "Marriage at Cana",
         "Mattia_Preti_-_Marriage_at_Cana_-_WGA18399.jpg"),
        ("Maerten de Vos", "The Wedding at Cana",
         "Maerten_de_Vos_-_Marriage_at_Cana.jpg"),
        ("Gerard David", "The Marriage at Cana",
         "Gerard_David_-_The_Marriage_at_Cana_-_WGA6041.jpg"),
        ("Bartolomé Esteban Murillo", "The Marriage at Cana",
         "Bartolomé_Esteban_Murillo_-_The_Marriage_Feast_at_Cana.jpg"),
    ],
    "luminous_3": [
        ("Fra Angelico", "Sermon on the Mount",
         "Fra_Angelico_-_Sermon_on_the_Mount_-_WGA00536.jpg"),
        ("James Tissot", "The Sermon of the Beatitudes",
         "Brooklyn_Museum_-_The_Sermon_of_the_Beatitudes_(La_predication_des_beatitudes)_-_James_Tissot.jpg"),
        ("Henrik Olrik", "Sermon on the Mount",
         "Henrik_Olrik_-_Sermon_on_the_Mount.jpg"),
        ("Bartolomé Esteban Murillo", "Christ Healing the Paralytic",
         "Bartolomé_Esteban_Murillo_-_Christ_Healing_the_Paralytic_at_the_Pool_of_Bethesda_-_WGA16420.jpg"),
        ("Henry Ossawa Tanner", "Christ and Nicodemus on a Rooftop",
         "Henry_Ossawa_Tanner_-_Christ_and_Nicodemus_on_a_Rooftop_-_Google_Art_Project.jpg"),
    ],
    "luminous_4": [
        ("Lorenzo Lotto", "The Transfiguration of Christ",
         "Lorenzo_Lotto_-_Transfiguration_of_Christ_-_WGA13658.jpg"),
        ("Alexander Ivanov", "The Transfiguration",
         "Alexandr_Ivanov_009.jpg"),
        ("Theophanes the Greek", "The Transfiguration (c. 1408)",
         "Theophanes_the_Greek_-_Transfiguration_of_Jesus.jpg"),
        ("Gentile da Fabriano", "The Transfiguration",
         "Gentile_da_Fabriano_-_The_Transfiguration_-_WGA08552.jpg"),
    ],
    "luminous_5": [
        ("Salvador Dalí", "The Sacrament of the Last Supper (1955)",
         "Dalí_-_The_Sacrament_of_the_Last_Supper.jpg"),
        ("Dieric Bouts", "The Last Supper",
         "Dieric_Bouts_-_The_Last_Supper_-_WGA03007.jpg"),
        ("Jacopo Bassano", "The Last Supper",
         "Jacopo_Bassano_-_The_Last_Supper_-_WGA01416.jpg"),
        ("Nicolas Poussin", "The Eucharist (Seven Sacraments)",
         "Nicolas_Poussin_-_The_Sacrament_of_the_Eucharist.jpg"),
    ],
    "sorrowful_1": [
        ("Andrea Mantegna", "The Agony in the Garden",
         "Andrea_Mantegna_-_The_Agony_in_the_Garden_-_Google_Art_Project.jpg"),
        ("Giovanni Bellini", "The Agony in the Garden",
         "Giovanni_Bellini_-_The_Agony_in_the_Garden_-_WGA01797.jpg"),
        ("Heinrich Hofmann", "Christ in Gethsemane (1890)",
         "Heinrich_Ferdinand_Hofmann_-_Christus_in_Gethsemane.jpg"),
        ("Paul Gauguin", "Christ in the Garden of Olives (1889)",
         "Paul_Gauguin_-_Christ_in_the_Garden_of_Olives_-_Google_Art_Project.jpg"),
        ("Albrecht Dürer", "Christ on the Mount of Olives",
         "Albrecht_Dürer_-_Christ_on_the_Mount_of_Olives_-_WGA07005.jpg"),
    ],
    "sorrowful_2": [
        ("William-Adolphe Bouguereau", "The Flagellation of Our Lord Jesus Christ (1880)",
         "William-Adolphe_Bouguereau_-_The_Flagellation_of_Our_Lord_Jesus_Christ_(1880).jpg"),
        ("Lodovico Carracci", "The Flagellation of Christ",
         "Ludovico_Carracci_-_The_Flagellation_of_Christ_-_WGA04504.jpg"),
        ("Diego Velázquez", "Christ After the Flagellation",
         "Diego_Velázquez_-_Christ_After_the_Flagellation_Contemplated_by_the_Christian_Soul_-_Google_Art_Project.jpg"),
    ],
    "sorrowful_3": [
        ("Antonello da Messina", "Christ Crowned with Thorns",
         "Antonello_da_Messina_-_Ecce_Homo_-_WGA00755.jpg"),
        ("Quentin Matsys", "Ecce Homo",
         "Quentin_Matsys_-_Ecce_Homo_-_WGA14290.jpg"),
        ("Andrea Mantegna", "Ecce Homo",
         "Andrea_Mantegna_-_Ecce_Homo_-_WGA13988.jpg"),
        ("Albrecht Dürer", "Christ Crowned with Thorns (Small Passion)",
         "Albrecht_Dürer_-_Christ_Crowned_with_Thorns_-_WGA07028.jpg"),
    ],
    "sorrowful_4": [
        ("Pieter Bruegel the Elder", "The Procession to Calvary (1564)",
         "Pieter_Bruegel_the_Elder_-_The_Procession_to_Calvary_-_Google_Art_Project.jpg"),
        ("Sebastiano del Piombo", "Christ Carrying the Cross",
         "Sebastiano_del_Piombo_-_Christ_Carrying_the_Cross_-_WGA21092.jpg"),
        ("Martin Schongauer", "Christ Carrying the Cross",
         "Martin_Schongauer_-_Christ_Carrying_the_Cross_-_WGA21025.jpg"),
        ("Giovanni Battista Tiepolo", "Christ Carrying the Cross",
         "Giovanni_Battista_Tiepolo_-_Christ_Carrying_the_Cross.jpg"),
    ],
    "sorrowful_5": [
        ("Salvador Dalí", "Christ of Saint John of the Cross (1951)",
         "Christ_of_Saint_John_of_the_Cross.jpg"),
        ("Raphael", "The Mond Crucifixion",
         "Raphael_-_The_Mond_Crucifixion.jpg"),
        ("Marc Chagall", "White Crucifixion (1938)",
         "Marc_Chagall,_1938,_White_Crucifixion,_oil_on_canvas,_154.6_x_140_cm,_Art_Institute_of_Chicago.jpg"),
        ("El Greco", "The Crucifixion",
         "El_Greco_-_Crucifixion_-_WGA10568.jpg"),
        ("Albrecht Altdorfer", "Crucifixion of Christ",
         "Albrecht_Altdorfer_-_Crucifixion_of_Christ_-_WGA00211.jpg"),
    ],
    "glorious_1": [
        ("Matthias Grünewald", "The Resurrection (Isenheim Altarpiece)",
         "Mathis_Gothart_Grünewald_-_Stuppach_Madonna_-_Resurrection.jpg"),
        ("Andrea Mantegna", "The Resurrection of Christ",
         "Andrea_Mantegna_-_Resurrection_of_Christ_-_WGA13961.jpg"),
        ("Carl Heinrich Bloch", "The Resurrection",
         "Carl_Heinrich_Bloch_-_Resurrection_-_WGA02440.jpg"),
        ("Hans Memling", "The Resurrection",
         "Hans_Memling_-_The_Resurrection_-_WGA15010.jpg"),
        ("Eugène Burnand", "The Disciples Peter and John Running to the Sepulchre",
         "Eugène_Burnand_-_The_disciples_Peter_and_John_running_to_the_sepulchre_on_the_morning_of_the_Resurrection.jpg"),
    ],
    "glorious_2": [
        ("Andrea Mantegna", "Ascension of Christ",
         "Andrea_Mantegna_-_Ascension_-_WGA13957.jpg"),
        ("Salvador Dalí", "The Ascension of Christ (1958)",
         "Salvador_Dalí_-_The_Ascension_of_Christ.jpg"),
        ("Hans Süss von Kulmbach", "The Ascension of Christ",
         "Hans_Süss_von_Kulmbach_-_Ascension_of_Christ_-_WGA12190.jpg"),
        ("Carl Heinrich Bloch", "Christ's Ascension",
         "Carl_Heinrich_Bloch_-_Christ's_Ascension.jpg"),
    ],
    "glorious_3": [
        ("Fra Angelico", "Pentecost",
         "Fra_Angelico_-_Pentecost_-_WGA00532.jpg"),
        ("Duccio di Buoninsegna", "Pentecost",
         "Duccio_-_Pentecost_-_WGA06734.jpg"),
        ("Giotto di Bondone", "Pentecost",
         "Giotto_di_Bondone_-_Pentecost_-_WGA09276.jpg"),
        ("Jean Restout the Younger", "Pentecost",
         "Jean_Restout_-_Pentecost_-_WGA19318.jpg"),
        ("Maerten van Heemskerck", "Pentecost",
         "Maerten_van_Heemskerck_-_The_Pentecost_-_WGA11267.jpg"),
        ("Juan Bautista Maíno", "Pentecost",
         "Juan_Bautista_Maíno_-_Pentecost_-_WGA13912.jpg"),
    ],
    "glorious_4": [
        ("Francesco Botticini", "The Assumption of the Virgin",
         "Francesco_Botticini_-_The_Assumption_of_the_Virgin_-_NG1126.jpg"),
        ("Carlo Maratta", "The Assumption of the Virgin",
         "Carlo_Maratta_-_The_Assumption_of_the_Virgin_-_WGA14219.jpg"),
        ("Giovanni Battista Tiepolo", "Assumption of the Virgin",
         "Giovanni_Battista_Tiepolo_-_The_Assumption_of_the_Virgin_-_WGA22250.jpg"),
        ("Albrecht Dürer", "Assumption and Coronation of the Virgin (Heller Altarpiece)",
         "Albrecht_Dürer_-_The_Assumption_and_Coronation_of_the_Virgin_-_WGA07083.jpg"),
    ],
    "glorious_5": [
        ("Paolo Veronese", "Coronation of the Virgin",
         "Paolo_Veronese_-_Coronation_of_the_Virgin_-_WGA24811.jpg"),
        ("Giotto di Bondone", "Coronation of the Virgin (Baroncelli Polyptych)",
         "Giotto_di_Bondone_-_Polyptych_of_Baroncelli_-_Coronation_of_the_Virgin_-_WGA09298.jpg"),
        ("Pinturicchio", "Coronation of the Virgin",
         "Pinturicchio_-_Coronation_of_the_Virgin_-_WGA17782.jpg"),
        ("Diego Velázquez", "Coronation of the Virgin (Prado)",
         "Diego_Velázquez_-_Coronation_of_the_Virgin_-_Google_Art_Project.jpg"),
    ],
}


def main():
    with open(PATH, "r", encoding="utf-8") as f:
        data = json.load(f, object_pairs_hook=OrderedDict)

    summary = []
    for mset in data.values():
        for m in mset["mysteries"]:
            mid = m["id"]
            existing_urls = {p["url"] for p in m["paintings"]}
            existing_titles = {(p["artist"], p["title"]) for p in m["paintings"]}
            to_add = ADDITIONS.get(mid, [])
            added = 0
            for artist, title, fname in to_add:
                url = commons(fname)
                if url in existing_urls:
                    continue
                if (artist, title) in existing_titles:
                    continue
                m["paintings"].append({
                    "artist": artist,
                    "title": title,
                    "url": url,
                })
                existing_urls.add(url)
                existing_titles.add((artist, title))
                added += 1
            summary.append((mid, m["name"], len(m["paintings"]), added))

    with open(PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"{'id':14s} {'mystery':38s} {'total':>6s} {'added':>6s}")
    for mid, name, total, added in summary:
        ok = "OK" if total >= 10 else "LOW"
        print(f"{mid:14s} {name:38s} {total:>6d} {added:>6d}  {ok}")


if __name__ == "__main__":
    main()
