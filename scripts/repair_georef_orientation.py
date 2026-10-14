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


def restore_source_verified_derived_axis(chart):
    """Restore a derived axis metadata row from source-verified control points.

    Four V2621 SID main-plan calibrations use one printed axis together with
    a measured orthogonal grid. Their already checked point set has a
    non-zero, orientation-correct geographic span. Restore its *metadata*
    only, leaving the georeferencing transform and exclusion masks unchanged.
    Never synthesize a missing axis on unreviewed charts.
    """
    if chart.get("validation", {}).get("reviewDecision") != (
        "fingerprint_bound_printed_vector_grid_plus_inset_mask"
    ):
        return False

    points = chart.get("points") or []
    axes = chart["gridAxes"]
    repaired = False
    for axis_name, degree_key in (("latitude", "lat"), ("longitude", "lon")):
        controls = axes[axis_name]
        if len(controls) != 1:
            continue
        measured = controls[0]
        if measured.get("derived"):
            raise ValueError(f"Page {chart.get('page')}: no measured {axis_name} grid")

        pix_key = measured["pixelAxis"]
        measured_degree = float(measured["degrees"])
        candidates = [
            point for point in points
            if abs(float(point[degree_key]) - measured_degree) > 1e-9
        ]
        if not candidates:
            raise ValueError(f"Page {chart.get('page')}: missing {axis_name} geographic span")

        # Keep exactly the same page-space coordinates already independently
        # tested against printed grid ticks, not a fresh or invented projection.
        ref = candidates[0]
        target_degree = float(ref[degree_key])
        pdf_pixel = float(ref[pix_key])
        if not all(
            abs(float(p[pix_key]) - pdf_pixel) < .001
            for p in candidates
            if abs(float(p[degree_key]) - target_degree) < 1e-9
        ):
            raise ValueError(f"Page {chart.get('page')}: inconsistent {axis_name} points")

        derived = dict(measured)
        derived.update(
            degrees=target_degree,
            pdfPoint=pdf_pixel,
            label=None,
            labelBounds=None,
            tickSegment=None,
            derived=True,
            derivation="orthogonal_conformal_scale",
        )
        axes[axis_name] = sorted([measured, derived], key=lambda x: x["degrees"])
        repaired = True

    if repaired and orientation_determinant(chart) >= 0:
        raise ValueError(f"Page {chart.get('page')}: reconstructed axis is mirrored")
    return repaired


def repair(chart):
    if chart.get("validation", {}).get("method") != "single_axis_plus_conformal_scale":
        return False

    restored_metadata = restore_source_verified_derived_axis(chart)
    if orientation_determinant(chart) < 0:
        return restored_metadata

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
            "repairedOrRestoredChartMetadata": len(repaired),
            "pages": repaired,
        })
    )


if __name__ == "__main__":
    main()
