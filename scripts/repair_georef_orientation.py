#!/usr/bin/env python3
"""Repair mirrored single-axis conformal georeferences in-place.

Older single_axis_plus_conformal_scale records coupled the sign of the derived
geographic axis to the sign of the PDF pixel offset. Because PDF y increases
downward, that can mirror the map. This repair keeps measured source evidence
unchanged and flips only the derived geographic direction when required.
"""
import argparse
import json
import os
from pathlib import Path


def axis_vector(values):
    ordered = sorted(values, key=lambda item: item["degrees"])
    first, last = ordered[0], ordered[-1]
    delta_degrees = last["degrees"] - first["degrees"]
    if abs(delta_degrees) <= 1e-12:
        raise ValueError("Zero geographic axis span")
    slope = (last["pdfPoint"] - first["pdfPoint"]) / delta_degrees
    axis = first["pixelAxis"]
    if axis == "x":
        return (slope, 0.0)
    if axis == "y":
        return (0.0, slope)
    raise ValueError(f"Unknown pixel axis: {axis}")


def orientation_determinant(chart):
    east = axis_vector(chart["gridAxes"]["longitude"])
    north = axis_vector(chart["gridAxes"]["latitude"])
    return east[0] * north[1] - east[1] * north[0]


def rebuild_points(chart):
    points = []
    for latitude in chart["gridAxes"]["latitude"]:
        for longitude in chart["gridAxes"]["longitude"]:
            points.append({
                "lat": latitude["degrees"],
                "lon": longitude["degrees"],
                "x": (
                    longitude["pdfPoint"]
                    if longitude["pixelAxis"] == "x"
                    else latitude["pdfPoint"]
                ),
                "y": (
                    longitude["pdfPoint"]
                    if longitude["pixelAxis"] == "y"
                    else latitude["pdfPoint"]
                ),
                "source": (
                    f"Printed grid {latitude['label']} / {longitude['label']}"
                    if latitude.get("label") and longitude.get("label")
                    else "Derived orthogonal conformal grid intersection"
                ),
            })
    chart["points"] = points


def repair(chart):
    if chart.get("validation", {}).get("method") != "single_axis_plus_conformal_scale":
        return False

    if orientation_determinant(chart) < 0:
        return False

    derived_axes = [
        name
        for name, values in chart["gridAxes"].items()
        if any(value.get("derived") for value in values)
    ]
    if len(derived_axes) != 1:
        raise ValueError(
            f"Page {chart.get('page')}: expected one derived axis"
        )

    axis_name = derived_axes[0]
    values = chart["gridAxes"][axis_name]
    measured = [value for value in values if not value.get("derived")]
    derived = [value for value in values if value.get("derived")]

    if len(measured) != 1 or len(derived) != 1:
        raise ValueError(
            f"Page {chart.get('page')}: invalid single-axis controls"
        )

    measured_value = measured[0]
    derived_value = derived[0]

    # Keep the chosen page-space point and conformal scale, but put its
    # geographic value on the opposite side of the measured singleton.
    # This reverses handedness without inventing new source evidence.
    derived_value["degrees"] = (
        2.0 * measured_value["degrees"] -
        derived_value["degrees"]
    )

    chart["gridAxes"][axis_name] = sorted(
        values,
        key=lambda item: item["degrees"],
    )

    rebuild_points(chart)

    if orientation_determinant(chart) >= 0:
        raise ValueError(
            f"Page {chart.get('page')}: mirrored orientation remains"
        )

    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path")
    args = parser.parse_args()

    path = Path(args.path)
    root = json.loads(path.read_text(encoding="utf-8"))

    repaired = []
    for chart in root.get("charts", []):
        if repair(chart):
            repaired.append(chart.get("page"))

    mirrored = [
        chart.get("page")
        for chart in root.get("charts", [])
        if orientation_determinant(chart) >= 0
    ]
    if mirrored:
        raise SystemExit(
            "Mirrored georeferences remain: " +
            ", ".join(map(str, mirrored[:20]))
        )

    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(
        json.dumps(root, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    os.replace(temp, path)

    print(
        json.dumps({
            "repairedMirroredCharts": len(repaired),
            "pages": repaired,
        })
    )


if __name__ == "__main__":
    main()
